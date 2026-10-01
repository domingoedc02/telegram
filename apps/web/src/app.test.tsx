import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { authApi } from './lib/api-client';

vi.mock('./lib/api-client', () => ({
  authApi: { me: vi.fn() },
}));

const mockedMe = vi.mocked(authApi.me);

describe('App', () => {
  it('redirects an unauthenticated visitor from "/" to the login stub', async () => {
    mockedMe.mockRejectedValueOnce(new Error('401'));
    window.history.pushState({}, '', '/');

    const { App } = await import('./app');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText(/sign in — enlinka chat/i)).toBeInTheDocument();
    });
  });

  it('renders the protected placeholder once /auth/me resolves', async () => {
    mockedMe.mockResolvedValueOnce({
      user: {
        id: '1',
        email: 'a@test',
        name: 'A',
        role: 'member',
        deactivatedAt: null,
        createdAt: 'x',
      },
    });
    window.history.pushState({}, '', '/');

    const { App } = await import('./app');
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Enlinka Chat' })).toBeInTheDocument();
    });
  });
});
