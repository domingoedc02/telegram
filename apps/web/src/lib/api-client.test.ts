import { CSRF_HEADER, CSRF_HEADER_VALUE } from '@tg/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, authApi } from './api-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api-client', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sends credentials: "include" and the CSRF header on a mutating call', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: {
          id: '1',
          email: 'a@test',
          name: 'A',
          role: 'member',
          deactivatedAt: null,
          createdAt: 'x',
        },
      }),
    );

    await authApi.login({ email: 'a@test', password: 'secret' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    const headers = init.headers as Record<string, string>;
    expect(headers[CSRF_HEADER]).toBe(CSRF_HEADER_VALUE);
  });

  it('omits the CSRF header on a GET call', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, {
        user: {
          id: '1',
          email: 'a@test',
          name: 'A',
          role: 'member',
          deactivatedAt: null,
          createdAt: 'x',
        },
      }),
    );

    await authApi.me();

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers[CSRF_HEADER]).toBeUndefined();
  });

  it("throws a typed ApiError with the server's code and message on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(409, { error: { code: 'LAST_ADMIN', message: 'cannot demote the last admin' } }),
    );

    await expect(authApi.login({ email: 'a@test', password: 'bad' })).rejects.toMatchObject({
      code: 'LAST_ADMIN',
      message: 'cannot demote the last admin',
    });
  });

  it('throws an ApiError instance, not a generic Error', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(401, { error: { code: 'INVALID_CREDENTIALS', message: 'nope' } }),
    );

    const error: unknown = await authApi
      .login({ email: 'a@test', password: 'bad' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
  });

  it('returns undefined for a 204 response (e.g. logout)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(authApi.logout()).resolves.toBeUndefined();
  });
});
