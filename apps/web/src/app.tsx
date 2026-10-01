// Router root. Chat/admin/app-shell screens land with later issues (TG-14..26)
// — this issue (TG-11) wires only the router, the auth guard, and a login
// stub + a protected placeholder so the guard has something real to redirect
// to and protect.

import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { AuthGuard } from './components/AuthGuard/AuthGuard';
import { LoginPage } from './pages/LoginPage';

function ProtectedHome(): ReactElement {
  return (
    <main>
      <h1>Enlinka Chat</h1>
      <p>Signed in — chat screens land with later issues.</p>
    </main>
  );
}

export function App(): ReactElement {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard />}>
          <Route path="/" element={<ProtectedHome />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
