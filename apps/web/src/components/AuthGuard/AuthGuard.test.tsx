import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { SessionState } from '../../features/auth/useSession';

import { AuthGuard } from './AuthGuard';

const mockUseSession = vi.fn<() => SessionState>();
vi.mock('../../features/auth/useSession', () => ({
  useSession: () => mockUseSession(),
}));

function renderGuardedApp(): void {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/login" element={<div>login page</div>} />
        <Route element={<AuthGuard />}>
          <Route path="/" element={<div>protected home</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AuthGuard', () => {
  it('renders nothing while the session is loading (no flash of the login page)', () => {
    mockUseSession.mockReturnValue({ status: 'loading', user: null });
    renderGuardedApp();
    expect(screen.queryByText('protected home')).not.toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });

  it('redirects to /login when unauthenticated', () => {
    mockUseSession.mockReturnValue({ status: 'unauthenticated', user: null });
    renderGuardedApp();
    expect(screen.getByText('login page')).toBeInTheDocument();
  });

  it('renders the protected route when authenticated', () => {
    mockUseSession.mockReturnValue({
      status: 'authenticated',
      user: {
        id: '1',
        email: 'a@test',
        name: 'A',
        role: 'member',
        deactivatedAt: null,
        createdAt: 'x',
      },
    });
    renderGuardedApp();
    expect(screen.getByText('protected home')).toBeInTheDocument();
  });
});
