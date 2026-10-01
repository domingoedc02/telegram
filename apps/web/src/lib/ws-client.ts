// WebSocket client: connect, reconnect with backoff, replay `/sync` on
// reconnect before trusting live frames, and a typed subscribe API.
//
// The one invariant this module must never violate (decision/realtime-transport,
// spec/flows/realtime "Reconnect + backfill by cursor"): after a (re)connect,
// the client calls `GET /sync?after=<highestSeq>` and applies every backfilled
// message to subscribers' handlers BEFORE any frame received on the new
// socket is dispatched. Getting this backwards reintroduces exactly the
// duplicate/gap bugs spec/testing's reconnect AC exists to catch.

import {
  clientFrameSchema,
  parseServerFrame,
  seqOf,
  type ClientFrameType,
  type ServerFrame,
  type ServerFrameType,
} from '@tg/shared';

import { syncApi } from './api-client';

type FrameHandler<T extends ServerFrameType> = (
  payload: Extract<ServerFrame, { type: T }>['payload'],
) => void;

export type WsClientState = 'idle' | 'connecting' | 'syncing' | 'open' | 'closed';

export interface WsClientOptions {
  /** Defaults to `wss://<host>/ws` (or `ws://` in dev) — overridable for tests. */
  url?: string;
  /** `Sec-WebSocket-Protocol`, per spec/api. Defaults to `tg-v1`. */
  protocol?: string;
  /** Injectable WebSocket constructor, so tests don't need a real socket. */
  createSocket?: (url: string, protocol: string) => WebSocket;
  /** Injectable backfill call — defaults to `syncApi.since`. */
  fetchSync?: (afterSeq: number) => ReturnType<typeof syncApi.since>;
  /** Seeds the cursor used for the very first reconnect's `/sync?after=`. */
  initialSeq?: number;
  /** Backoff tuning, exposed for deterministic tests. */
  backoff?: Partial<BackoffOptions>;
  /** Injectable clock for scheduling reconnects in tests. */
  setTimeoutFn?: typeof setTimeout;
  clearTimeoutFn?: typeof clearTimeout;
}

export interface BackoffOptions {
  baseMs: number;
  capMs: number;
  jitterRatio: number;
  random: () => number;
}

const DEFAULT_BACKOFF: BackoffOptions = {
  baseMs: 500,
  capMs: 30_000,
  jitterRatio: 0.2,
  random: Math.random,
};

/**
 * Exponential backoff with jitter: `base * 2^attempt`, capped at `capMs`, then
 * jittered by up to `±jitterRatio` so two clients reconnecting after the same
 * server restart don't retry in lockstep. `attempt` is 0 for the first retry
 * (500ms by default), 1 for the second (1000ms), etc.
 */
export function computeBackoffDelay(
  attempt: number,
  options: Partial<BackoffOptions> = {},
): number {
  const { baseMs, capMs, jitterRatio, random } = { ...DEFAULT_BACKOFF, ...options };
  const raw = Math.min(baseMs * 2 ** attempt, capMs);
  const jitter = raw * jitterRatio * (random() * 2 - 1);
  return Math.max(0, Math.round(raw + jitter));
}

function defaultWsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export interface WsClient {
  connect: () => void;
  disconnect: () => void;
  send: (type: ClientFrameType, payload: Record<string, unknown>) => void;
  /** Registers a handler for one server frame type; returns an unsubscribe function. */
  onMessage: <T extends ServerFrameType>(type: T, handler: FrameHandler<T>) => () => void;
  getState: () => WsClientState;
  getHighestSeq: () => number;
}

export function createWsClient(options: WsClientOptions = {}): WsClient {
  const url = options.url ?? defaultWsUrl();
  const protocol = options.protocol ?? 'tg-v1';
  const createSocket = options.createSocket ?? ((u, p) => new WebSocket(u, p));
  const fetchSync = options.fetchSync ?? syncApi.since;
  // Resolved lazily (inside scheduleReconnect/disconnect below) rather than
  // captured here: a test that enables fake timers (vi.useFakeTimers()) after
  // constructing the client needs each call to re-read the *current* global
  // setTimeout/clearTimeout, not whichever one was live at construction time.
  const backoffOptions = options.backoff ?? {};

  let state: WsClientState = 'idle';
  let socket: WebSocket | null = null;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let manuallyClosed = false;
  let highestSeq = options.initialSeq ?? 0;
  const bufferedFrames: ServerFrame[] = [];

  // Stored as `(payload: unknown) => void` rather than the precise
  // `FrameHandler<T>` per entry: a single Map keyed by frame type can't carry
  // a different concrete payload type per key in TS's type system without an
  // intersection that doesn't actually hold (each frame type's payload is
  // unrelated to the others'). `onMessage`'s public signature below is still
  // fully typed; only this internal bookkeeping is loosened.
  const handlers = new Map<ServerFrameType, Set<(payload: unknown) => void>>();

  function dispatch(frame: ServerFrame): void {
    const seq = seqOf(frame);
    if (seq !== null && seq > highestSeq) {
      highestSeq = seq;
    }
    const set = handlers.get(frame.type);
    if (!set) {
      return;
    }
    for (const handler of set) {
      handler(frame.payload);
    }
  }

  function scheduleReconnect(): void {
    if (manuallyClosed) {
      return;
    }
    const delay = computeBackoffDelay(attempt, backoffOptions);
    attempt += 1;
    const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
    reconnectTimer = setTimeoutFn(() => {
      connectSocket();
    }, delay);
  }

  function handleOpen(): void {
    state = 'syncing';
    const afterSeq = highestSeq;
    fetchSync(afterSeq)
      .then((result) => {
        for (const message of result.messages) {
          dispatch({ type: 'message:new', payload: { message } });
        }
        // Flush anything the socket delivered while the backfill call was in
        // flight, in arrival order, now that backfill has been applied first.
        const buffered = bufferedFrames.splice(0, bufferedFrames.length);
        for (const frame of buffered) {
          dispatch(frame);
        }
        state = 'open';
        attempt = 0;
      })
      .catch(() => {
        // A failed backfill leaves the socket open but un-synced; the next
        // scheduled reconnect (triggered by the eventual close/error, or a
        // manual retry) will try again. Buffered live frames are kept so a
        // transient /sync failure doesn't drop them outright once a later
        // sync succeeds.
        state = 'open';
      });
  }

  function handleMessage(event: MessageEvent): void {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(typeof event.data === 'string' ? event.data : '');
    } catch {
      console.warn('ws-client: dropped a frame that was not valid JSON');
      return;
    }
    const frame = parseServerFrame(parsedJson);
    if (!frame) {
      console.warn('ws-client: dropped a frame that failed envelope validation', parsedJson);
      return;
    }
    if (state === 'syncing') {
      bufferedFrames.push(frame);
      return;
    }
    dispatch(frame);
  }

  function handleCloseOrError(): void {
    socket = null;
    if (manuallyClosed) {
      state = 'closed';
      return;
    }
    state = 'closed';
    scheduleReconnect();
  }

  function connectSocket(): void {
    state = 'connecting';
    const ws = createSocket(url, protocol);
    socket = ws;
    ws.addEventListener('open', handleOpen);
    ws.addEventListener('message', handleMessage);
    ws.addEventListener('close', handleCloseOrError);
    ws.addEventListener('error', handleCloseOrError);
  }

  return {
    connect(): void {
      manuallyClosed = false;
      connectSocket();
    },
    disconnect(): void {
      manuallyClosed = true;
      if (reconnectTimer !== null) {
        const clearTimeoutFn = options.clearTimeoutFn ?? clearTimeout;
        clearTimeoutFn(reconnectTimer);
        reconnectTimer = null;
      }
      socket?.close();
      socket = null;
      state = 'closed';
    },
    send(type: ClientFrameType, payload: Record<string, unknown>): void {
      if (!socket || state !== 'open') {
        console.warn(`ws-client: dropped outgoing "${type}" frame — socket is not open`);
        return;
      }
      const frame = clientFrameSchema.safeParse({ type, payload });
      if (!frame.success) {
        console.warn(`ws-client: refused to send an invalid "${type}" frame`);
        return;
      }
      socket.send(JSON.stringify(frame.data));
    },
    onMessage<T extends ServerFrameType>(type: T, handler: FrameHandler<T>): () => void {
      let set = handlers.get(type);
      if (!set) {
        set = new Set();
        handlers.set(type, set);
      }
      const loose = handler as unknown as (payload: unknown) => void;
      set.add(loose);
      return () => {
        set?.delete(loose);
      };
    },
    getState(): WsClientState {
      return state;
    },
    getHighestSeq(): number {
      return highestSeq;
    },
  };
}
