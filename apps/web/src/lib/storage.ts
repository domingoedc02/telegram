// Local-only UI preferences — e.g. a collapsed-sidebar flag. This is a stub;
// real preferences land with the feature issues that need them.
//
// Session/auth state must NEVER be written here. The session cookie is
// HttpOnly (spec/security Session & token handling) specifically so no
// JS-readable storage can leak it to an XSS payload; caching the role or a
// "signed in" flag here would reopen that hole and would also go stale after
// a role change forces a re-login. If a future feature needs to know who's
// signed in, it calls `useSession()` (features/auth/useSession.ts), not this
// module.

const PREFIX = 'tg:ui:';

export function getUiPref(key: string): string | null {
  try {
    return window.localStorage.getItem(`${PREFIX}${key}`);
  } catch {
    // localStorage can throw (private browsing, quota, disabled) — a missing
    // preference just falls back to its default, never a hard failure.
    return null;
  }
}

export function setUiPref(key: string, value: string): void {
  try {
    window.localStorage.setItem(`${PREFIX}${key}`, value);
  } catch {
    // Best-effort only; see getUiPref.
  }
}
