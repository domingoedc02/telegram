// Route-level guard: redirects to /login when GET /auth/me says the caller
// isn't signed in, and renders the protected subtree (via <Outlet/>)
// otherwise. The guard checks session presence only — it never caches a role
// client-side (spec/security/authz: role must be read server-side, per
// request, from the live session, never inferred from a client-supplied or
// cached field).

import type { ReactElement } from 'react';
import { Navigate, Outlet } from 'react-router-dom';

import { useSession } from '../../features/auth/useSession';

export function AuthGuard(): ReactElement | null {
  const { status } = useSession();

  if (status === 'loading') {
    // Avoid a flash of the login page while /auth/me is still resolving.
    return null;
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
