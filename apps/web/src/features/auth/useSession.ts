// Backs <AuthGuard>: calls GET /auth/me once on mount and resolves to
// 'authenticated' | 'unauthenticated' | 'loading'. No global store (TanStack
// Query or similar) is introduced here — TG-11's own description leaves that
// choice to the first feature issue that actually needs a server-cache
// layer; this hook is intentionally the simplest thing that works.

import { useEffect, useState } from 'react';
import type { User } from '@tg/shared';

import { authApi } from '../../lib/api-client';

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated'; user: null };

export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({ status: 'loading', user: null });

  useEffect(() => {
    let cancelled = false;

    authApi
      .me()
      .then(({ user }) => {
        if (!cancelled) {
          setState({ status: 'authenticated', user });
        }
      })
      .catch(() => {
        // Any failure — 401 UNAUTHENTICATED, a network error, or a 5xx — lands
        // the guard on /login rather than hanging on "loading" forever. A
        // dedicated error/retry state can be added by a later issue if this
        // proves too blunt in practice.
        if (!cancelled) {
          setState({ status: 'unauthenticated', user: null });
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
