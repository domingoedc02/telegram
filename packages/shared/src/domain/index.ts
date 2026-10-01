// Pure domain constants/enums shared by apps/web and apps/server. No I/O, no
// drizzle imports, no fetch, no ws — see spec/file-structure's module-boundary
// rule for packages/shared.

/** Exactly one role per account (`spec/security/authz`). */
export const ROLES = ['member', 'admin'] as const;
export type Role = (typeof ROLES)[number];

/**
 * A conversation's shape. Public/private channels are joinable differently
 * (`spec/flows/user-a`); DMs are find-or-create for a 2-person set
 * (`spec/api` POST /dms).
 */
export const CONVERSATION_TYPES = ['channel_public', 'channel_private', 'dm'] as const;
export type ConversationType = (typeof CONVERSATION_TYPES)[number];

/** Who soft-deleted a message — self (own message) or an admin (moderation). */
export const DELETE_REASONS = ['self', 'admin'] as const;
export type DeleteReason = (typeof DELETE_REASONS)[number];

/** Online/offline presence state broadcast over `presence:update` (`spec/api`). */
export const PRESENCE_STATUSES = ['online', 'offline'] as const;
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number];
