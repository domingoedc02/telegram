import { describe, expect, it } from 'vitest';

import { CSRF_HEADER, CSRF_HEADER_VALUE } from './csrf.js';

describe('csrf constants', () => {
  it('is the client-decided canonical header name and value (decision/csrf-header-name)', () => {
    expect(CSRF_HEADER).toBe('X-Requested-With');
    expect(CSRF_HEADER_VALUE).toBe('XMLHttpRequest');
  });
});
