// Request/response DTOs shared by apps/web and apps/server, per `spec/api`.
// zod schemas are the source of truth; TS types are inferred from them so the
// two never drift. This issue (TG-11) seeds the foundational shapes every
// other domain issue's routes will extend — it is not responsible for every
// DTO existing yet, only for the package existing correctly and the pattern
// (schema first, type inferred) being followed.

import { z } from 'zod';

import { CONVERSATION_TYPES, ROLES } from '../domain/index.js';

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.enum(ROLES),
  // Present (non-null) once an admin deactivates the account — `spec/architecture`
  // AuthService: "deactivated user cannot authenticate" (`research/domain-rules` #20).
  deactivatedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof userSchema>;

export const conversationSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(CONVERSATION_TYPES),
  // null for a DM; channels are named (`spec/api` POST /channels).
  name: z.string().nullable(),
  topic: z.string().nullable(),
  ownerId: z.string().uuid().nullable(),
  unreadCount: z.number().int().nonnegative().optional(),
});
export type Conversation = z.infer<typeof conversationSchema>;

export const messageSchema = z.object({
  id: z.string().uuid(),
  conversationId: z.string().uuid(),
  seq: z.number().int().nonnegative(),
  senderId: z.string().uuid(),
  body: z.string(),
  threadRootId: z.string().uuid().nullable(),
  replyCount: z.number().int().nonnegative(),
  lastReplyAt: z.string().datetime().nullable(),
  editedAt: z.string().datetime().nullable(),
  deletedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  clientMessageId: z.string().uuid(),
});
export type Message = z.infer<typeof messageSchema>;

/** `{ error: { code, message, details? } }` — every non-2xx response (`spec/api` Errors). */
export const errorEnvelopeSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;

/** Cursor-pagination metadata attached to every list endpoint (`spec/api` Pagination & filtering). */
export const listMetaSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type ListMeta = z.infer<typeof listMetaSchema>;

/** `{ data: T[], meta }` — the common list envelope (`spec/api` Request/response shapes). */
export function listEnvelopeSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    data: z.array(item),
    meta: listMetaSchema,
  });
}
export type ListEnvelope<T> = { data: T[]; meta: ListMeta };

/** `GET /sync` response — cross-conversation backfill in one call (`spec/api`, `decision/realtime-transport`). */
export const syncResponseSchema = z.object({
  messages: z.array(messageSchema),
  meta: listMetaSchema,
});
export type SyncResponse = z.infer<typeof syncResponseSchema>;
