// WS envelope types + zod schemas — the single source of truth imported by
// both `apps/web`'s `lib/ws-client.ts` (TG-11) and the WebSocket-gateway
// issue's server code (TG-7). Coordinate changes with backend-dev rather than
// forking: `spec/file-structure`'s naming convention requires one shared
// schema, not two independently-evolving copies.
//
// Per `decision/realtime-transport`, every frame is `{ type, payload, seq? }`;
// `seq` is only meaningful on frames that carry a `message` (so the client can
// track the highest sequence number it has rendered for `/sync?after=`
// backfill) and is therefore modelled per-payload rather than on the generic
// envelope.

import { z } from 'zod';

import { messageSchema } from '../dto/index.js';

// ---- Client → server frames (`spec/api` WebSocket protocol) ----------------

const typingStartFrameSchema = z.object({
  type: z.literal('typing:start'),
  payload: z.object({ conversationId: z.string().uuid() }),
});

const typingStopFrameSchema = z.object({
  type: z.literal('typing:stop'),
  payload: z.object({ conversationId: z.string().uuid() }),
});

const pingFrameSchema = z.object({
  type: z.literal('ping'),
  payload: z.object({}),
});

export const clientFrameSchema = z.discriminatedUnion('type', [
  typingStartFrameSchema,
  typingStopFrameSchema,
  pingFrameSchema,
]);
export type ClientFrame = z.infer<typeof clientFrameSchema>;
export type ClientFrameType = ClientFrame['type'];

// ---- Server → client frames (`spec/api` WebSocket protocol) ---------------

const helloFrameSchema = z.object({
  type: z.literal('hello'),
  payload: z.object({ userId: z.string().uuid(), serverTime: z.string().datetime() }),
});

const messageNewFrameSchema = z.object({
  type: z.literal('message:new'),
  payload: z.object({ message: messageSchema }),
});

// Also covers an admin restore of a soft-deleted message (`deletedAt` clears) —
// `decision/ws-restore-event`; there is no separate `message:restored` event.
const messageUpdatedFrameSchema = z.object({
  type: z.literal('message:updated'),
  payload: z.object({ message: messageSchema }),
});

const messageDeletedFrameSchema = z.object({
  type: z.literal('message:deleted'),
  payload: z.object({ message: messageSchema }),
});

const threadReplyFrameSchema = z.object({
  type: z.literal('thread:reply'),
  payload: z.object({
    message: messageSchema,
    rootId: z.string().uuid(),
    rootReplyCount: z.number().int().nonnegative(),
    rootLastReplyAt: z.string().datetime().nullable(),
  }),
});

const typingFrameSchema = z.object({
  type: z.literal('typing'),
  payload: z.object({
    conversationId: z.string().uuid(),
    userId: z.string().uuid(),
    expiresAt: z.string().datetime(),
  }),
});

const presenceUpdateFrameSchema = z.object({
  type: z.literal('presence:update'),
  payload: z.object({
    userId: z.string().uuid(),
    status: z.enum(['online', 'offline']),
  }),
});

const readUpdatedFrameSchema = z.object({
  type: z.literal('read:updated'),
  payload: z.object({
    conversationId: z.string().uuid(),
    userId: z.string().uuid(),
    lastReadMessageId: z.string().uuid(),
  }),
});

const errorFrameSchema = z.object({
  type: z.literal('error'),
  payload: z.object({ code: z.string(), message: z.string() }),
});

export const serverFrameSchema = z.discriminatedUnion('type', [
  helloFrameSchema,
  messageNewFrameSchema,
  messageUpdatedFrameSchema,
  messageDeletedFrameSchema,
  threadReplyFrameSchema,
  typingFrameSchema,
  presenceUpdateFrameSchema,
  readUpdatedFrameSchema,
  errorFrameSchema,
]);
export type ServerFrame = z.infer<typeof serverFrameSchema>;
export type ServerFrameType = ServerFrame['type'];

/**
 * Parses an unknown value (typically `JSON.parse`d WS message data) as a
 * server frame. Returns `null` rather than throwing on anything that doesn't
 * match a known frame shape, so a malformed or forward-incompatible frame can
 * be dropped with a logged warning instead of crashing the connection
 * (`spec/api`'s WS error-mapper rule, mirrored client-side).
 */
export function parseServerFrame(data: unknown): ServerFrame | null {
  const result = serverFrameSchema.safeParse(data);
  return result.success ? result.data : null;
}

/** The highest `seq` carried by a frame's `message`, or `null` if it carries none. */
export function seqOf(frame: ServerFrame): number | null {
  if (
    frame.type === 'message:new' ||
    frame.type === 'message:updated' ||
    frame.type === 'message:deleted' ||
    frame.type === 'thread:reply'
  ) {
    return frame.payload.message.seq;
  }
  return null;
}
