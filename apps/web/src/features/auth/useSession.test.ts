import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { authApi } from '../../lib/api-client';

import { useSession } from './useSession';

vi.mock('../../lib/api-client', () => ({
  authApi: { me: vi.fn() },
}));

const mockedMe = vi.mocked(authApi.me);

describe('useSession', () => {
  it('starts in "loading" and resolves to "authenticated" on a 200', async () => {
    const user = {
      id: '1',
      email: 'a@test',
      name: 'A',
      role: 'member' as const,
      deactivatedAt: null,
      createdAt: 'x',
    };
    mockedMe.mockResolvedValueOnce({ user });

    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe('loading');

    await waitFor(() => {
      expect(result.current.status).toBe('authenticated');
    });
    expect(result.current.user).toEqual(user);
  });

  it('resolves to "unauthenticated" when GET /auth/me rejects (401 or otherwise)', async () => {
    mockedMe.mockRejectedValueOnce(new Error('401'));

    const { result } = renderHook(() => useSession());

    await waitFor(() => {
      expect(result.current.status).toBe('unauthenticated');
    });
    expect(result.current.user).toBeNull();
  });
});
