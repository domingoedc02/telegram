import { describe, expect, it } from 'vitest';

import { clientFrameSchema, parseServerFrame, seqOf, type ServerFrame } from './index.js';

const sampleMessage = {
  id: 'b3d10000-0000-4000-8000-000000000002',
  conversationId: 'a1c20000-0000-4000-8000-000000000003',
  seq: 42,
  senderId: '9f0e1234-0000-4000-8000-000000000001',
  body: 'hi',
  threadRootId: null,
  replyCount: 0,
  lastReplyAt: null,
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  clientMessageId: 'b7a90000-0000-4000-8000-000000000004',
};

describe('parseServerFrame', () => {
  it('parses a valid message:new frame', () => {
    const frame = parseServerFrame({ type: 'message:new', payload: { message: sampleMessage } });
    expect(frame?.type).toBe('message:new');
  });

  it('parses a valid hello frame', () => {
    const frame = parseServerFrame({
      type: 'hello',
      payload: {
        userId: '9f0e1234-0000-4000-8000-000000000001',
        serverTime: '2026-10-01T09:00:00.000Z',
      },
    });
    expect(frame?.type).toBe('hello');
  });

  it('returns null (never throws) for an unrecognised frame type', () => {
    expect(parseServerFrame({ type: 'bogus:event', payload: {} })).toBeNull();
  });

  it('returns null for a malformed payload on a known type', () => {
    expect(
      parseServerFrame({ type: 'message:new', payload: { message: { id: 'not-a-full-message' } } }),
    ).toBeNull();
  });

  it('returns null for non-object input', () => {
    expect(parseServerFrame('just a string')).toBeNull();
    expect(parseServerFrame(null)).toBeNull();
  });
});

describe('seqOf', () => {
  it('extracts the message seq from a message:new frame', () => {
    const frame = parseServerFrame({
      type: 'message:new',
      payload: { message: sampleMessage },
    }) as ServerFrame;
    expect(seqOf(frame)).toBe(42);
  });

  it('returns null for frames that carry no message (e.g. presence:update)', () => {
    const frame = parseServerFrame({
      type: 'presence:update',
      payload: { userId: '9f0e1234-0000-4000-8000-000000000001', status: 'online' },
    }) as ServerFrame;
    expect(seqOf(frame)).toBeNull();
  });
});

describe('clientFrameSchema', () => {
  it('accepts typing:start/typing:stop/ping', () => {
    expect(
      clientFrameSchema.safeParse({
        type: 'typing:start',
        payload: { conversationId: 'a1c20000-0000-4000-8000-000000000003' },
      }).success,
    ).toBe(true);
    expect(clientFrameSchema.safeParse({ type: 'ping', payload: {} }).success).toBe(true);
  });

  it('rejects a frame type the client is never allowed to send', () => {
    expect(clientFrameSchema.safeParse({ type: 'message:new', payload: {} }).success).toBe(false);
  });
});
