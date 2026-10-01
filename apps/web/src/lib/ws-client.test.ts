import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { computeBackoffDelay, createWsClient, type WsClientOptions } from './ws-client';

type Listener = (event: unknown) => void;

/** A minimal fake WebSocket — just enough of the EventTarget-style API for ws-client.ts. */
class FakeSocket {
  listeners = new Map<string, Set<Listener>>();
  sent: string[] = [];
  closed = false;

  addEventListener(type: string, cb: Listener): void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(cb);
  }

  removeEventListener(type: string, cb: Listener): void {
    this.listeners.get(type)?.delete(cb);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.closed = true;
    this.emit('close', {});
  }

  emit(type: string, event: unknown): void {
    for (const cb of this.listeners.get(type) ?? []) {
      cb(event);
    }
  }
}

function frame(data: unknown): { data: string } {
  return { data: JSON.stringify(data) };
}

const sampleUserId = '9f0e1234-0000-4000-8000-000000000001';
const sampleConversationId = 'a1c20000-0000-4000-8000-000000000003';

function sampleMessage(seq: number) {
  return {
    id: `b3d10000-0000-4000-8000-00000000000${seq % 10}`,
    conversationId: sampleConversationId,
    seq,
    senderId: sampleUserId,
    body: `message ${String(seq)}`,
    threadRootId: null,
    replyCount: 0,
    lastReplyAt: null,
    editedAt: null,
    deletedAt: null,
    createdAt: '2026-10-01T09:00:00.000Z',
    clientMessageId: `b7a90000-0000-4000-8000-00000000000${seq % 10}`,
  };
}

describe('computeBackoffDelay', () => {
  it('starts at the base delay (500ms) and doubles each attempt', () => {
    const random = () => 0.5; // midpoint -> zero jitter
    expect(computeBackoffDelay(0, { random })).toBe(500);
    expect(computeBackoffDelay(1, { random })).toBe(1000);
    expect(computeBackoffDelay(2, { random })).toBe(2000);
    expect(computeBackoffDelay(3, { random })).toBe(4000);
  });

  it('caps at 30s even for a large attempt count', () => {
    const random = () => 0.5;
    expect(computeBackoffDelay(20, { random })).toBe(30_000);
  });

  it('jitters by up to ±20% so two clients do not retry in lockstep', () => {
    const low = computeBackoffDelay(1, { random: () => 0 }); // -20%
    const high = computeBackoffDelay(1, { random: () => 1 }); // +20%
    expect(low).toBe(800); // 1000 - 200
    expect(high).toBe(1200); // 1000 + 200
  });
});

describe('createWsClient', () => {
  let sockets: FakeSocket[];
  let fetchSync: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sockets = [];
    fetchSync = vi
      .fn()
      .mockResolvedValue({ messages: [], meta: { nextCursor: null, hasMore: false } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Waits for pending microtasks (e.g. a resolved fetchSync promise) to flush, using the real clock. */
  async function flushMicrotasks(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function makeClient(overrides: Partial<WsClientOptions> = {}) {
    return createWsClient({
      url: 'ws://test/ws',
      createSocket: () => {
        const socket = new FakeSocket();
        sockets.push(socket);
        return socket as unknown as WebSocket;
      },
      fetchSync,
      ...overrides,
    });
  }

  it('calls fetchSync and applies backfilled messages before dispatching live frames received during sync (ordering)', async () => {
    const callOrder: string[] = [];
    fetchSync.mockImplementation((after: number) => {
      callOrder.push(`fetchSync(${String(after)})`);
      return Promise.resolve({
        messages: [sampleMessage(43), sampleMessage(44)],
        meta: { nextCursor: null, hasMore: false },
      });
    });

    const client = makeClient({ initialSeq: 42 });
    client.onMessage('message:new', (payload) => {
      callOrder.push(`dispatch(${String(payload.message.seq)})`);
    });

    client.connect();
    const socket = sockets[0]!;
    socket.emit('open', {});

    // A live frame arrives while the backfill call is still in flight.
    socket.emit('message', frame({ type: 'message:new', payload: { message: sampleMessage(45) } }));

    await flushMicrotasks();

    expect(client.getState()).toBe('open');
    expect(callOrder).toEqual(['fetchSync(42)', 'dispatch(43)', 'dispatch(44)', 'dispatch(45)']);
    expect(client.getHighestSeq()).toBe(45);
  });

  it('drops a frame that fails envelope validation without crashing', async () => {
    const client = makeClient();
    const handler = vi.fn();
    client.onMessage('message:new', handler);

    client.connect();
    const socket = sockets[0]!;
    socket.emit('open', {});
    await flushMicrotasks();
    expect(client.getState()).toBe('open');

    expect(() => {
      socket.emit('message', frame({ type: 'not:a:real:type', payload: {} }));
    }).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it('reconnects with exponential backoff after an unexpected close', async () => {
    const client = makeClient();
    client.connect();
    sockets[0]!.emit('open', {});
    await flushMicrotasks();
    expect(client.getState()).toBe('open');

    vi.useFakeTimers();
    sockets[0]!.emit('close', {});
    expect(client.getState()).toBe('closed');
    expect(sockets).toHaveLength(1);

    // First retry fires at ~500ms (±20% jitter, so anywhere up to 600ms) — not before.
    await vi.advanceTimersByTimeAsync(300);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(400);
    expect(sockets).toHaveLength(2);
  });

  it('does not schedule a reconnect after an explicit disconnect()', async () => {
    const client = makeClient();
    client.connect();
    sockets[0]!.emit('open', {});
    await flushMicrotasks();
    expect(client.getState()).toBe('open');

    vi.useFakeTimers();
    client.disconnect();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(sockets).toHaveLength(1);
  });

  it('send() attaches a validated client frame and no-ops when the socket is not open', async () => {
    const client = makeClient();
    client.send('typing:start', { conversationId: sampleConversationId });
    expect(sockets).toHaveLength(0); // never even connected — nothing to send on

    client.connect();
    sockets[0]!.emit('open', {});
    await flushMicrotasks();
    expect(client.getState()).toBe('open');

    client.send('typing:start', { conversationId: sampleConversationId });
    expect(sockets[0]!.sent).toHaveLength(1);
    expect(JSON.parse(sockets[0]!.sent[0]!)).toEqual({
      type: 'typing:start',
      payload: { conversationId: sampleConversationId },
    });
  });

  it('onMessage returns an unsubscribe function', async () => {
    const client = makeClient();
    const handler = vi.fn();
    const unsubscribe = client.onMessage('message:new', handler);

    client.connect();
    sockets[0]!.emit('open', {});
    await flushMicrotasks();
    expect(client.getState()).toBe('open');

    unsubscribe();
    sockets[0]!.emit(
      'message',
      frame({ type: 'message:new', payload: { message: sampleMessage(50) } }),
    );
    expect(handler).not.toHaveBeenCalled();
  });
});
