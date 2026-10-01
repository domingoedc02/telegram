// Typed REST client — one function per resource group (spec/file-structure).
// Every call attaches `credentials: "include"` so the HttpOnly session cookie
// is sent automatically (no token ever touches JS-readable storage, per
// spec/security/auth), and every mutating call attaches the CSRF header from
// the single shared constant (decision/csrf-header-name) rather than a
// hardcoded literal, so this file and the server's CSRF middleware (TG-10)
// can never drift.

import { CSRF_HEADER, CSRF_HEADER_VALUE, type SyncResponse, type User } from '@tg/shared';

const API_BASE = '/api/v1';

/** One error shape for every caller, regardless of which endpoint failed (spec/api Errors). */
export class ApiError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.details = details;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

function isErrorEnvelope(
  value: unknown,
): value is { error: { code: string; message: string; details?: Record<string, unknown> } } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as { error?: unknown }).error === 'object'
  );
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return `${url.pathname}${url.search}`;
}

/**
 * The one fetch wrapper every resource-group function below goes through.
 * GET requests never carry the CSRF header (exempt per spec/api); every other
 * method does, unconditionally — a future contributor adding a new mutating
 * call gets CSRF protection for free rather than needing to remember it.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (method !== 'GET') {
    headers[CSRF_HEADER] = CSRF_HEADER_VALUE;
  }

  const init: RequestInit = { method, credentials: 'include', headers };
  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }
  const response = await fetch(buildUrl(path, options.query), init);

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data: unknown = text.length > 0 ? JSON.parse(text) : undefined;

  if (!response.ok) {
    if (isErrorEnvelope(data)) {
      throw new ApiError(data.error.code, data.error.message, data.error.details);
    }
    throw new ApiError('UNKNOWN_ERROR', `Request failed with status ${String(response.status)}`);
  }

  return data as T;
}

export const authApi = {
  me: () => request<{ user: User }>('/auth/me'),
  login: (body: { email: string; password: string }) =>
    request<{ user: User }>('/auth/login', { method: 'POST', body }),
  logout: () => request<void>('/auth/logout', { method: 'POST' }),
  forgotPassword: (body: { email: string }) =>
    request<Record<string, never>>('/auth/forgot-password', { method: 'POST', body }),
  // Validates a reset token before the client renders the reset form
  // (spec/api: "mirrors GET /invites/:token's validate-before-render pattern").
  getResetToken: (token: string) =>
    request<Record<string, never>>(`/auth/reset/${encodeURIComponent(token)}`),
  resetPassword: (body: { token: string; newPassword: string }) =>
    request<Record<string, never>>('/auth/reset-password', { method: 'POST', body }),
};

/** `GET /sync?after=` — cross-conversation backfill in one call (decision/realtime-transport). */
export const syncApi = {
  since: (afterSeq: number) => request<SyncResponse>('/sync', { query: { after: afterSeq } }),
};
