// Canonical CSRF header, per `decision/csrf-header-name` (client decision,
// 2026-10-01): `X-Requested-With: XMLHttpRequest`, required on every
// POST/PUT/PATCH/DELETE under /api/v1, including the pre-session invite-accept
// and reset POSTs. GET/HEAD and the WS upgrade are exempt (the WS upgrade
// relies on the Origin check instead — see spec/security/authz).
//
// This is the single source of truth for the header name/value: `apps/web`'s
// `lib/api-client.ts` (TG-11) and `apps/server`'s CSRF middleware (TG-10) both
// import these two constants rather than hardcoding the literal, so the two
// sides can never silently drift. It is NOT configurable by env.
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_HEADER_VALUE = 'XMLHttpRequest';
