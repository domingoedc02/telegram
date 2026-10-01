// Minimal stub — the real sign-in form (email/password, forgot-password link,
// error states) is TG-5-5's job. This exists so TG-11's router has something
// to route /login to and <AuthGuard>'s redirect has a real destination.

import { useEffect, type ReactElement } from 'react';

export function LoginPage(): ReactElement {
  useEffect(() => {
    document.title = 'Sign in · Enlinka Chat';
  }, []);

  return (
    <main>
      <h1>Sign in — Enlinka Chat</h1>
      <p>The sign-in form lands with TG-5-5.</p>
    </main>
  );
}
