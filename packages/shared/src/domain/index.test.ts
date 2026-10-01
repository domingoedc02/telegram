import { describe, expect, it } from 'vitest';

import { CONVERSATION_TYPES, DELETE_REASONS, PRESENCE_STATUSES, ROLES } from './index.js';

describe('domain constants', () => {
  it('has exactly two roles — member and admin, no third role', () => {
    expect(ROLES).toEqual(['member', 'admin']);
  });

  it('covers the three conversation shapes', () => {
    expect(CONVERSATION_TYPES).toEqual(['channel_public', 'channel_private', 'dm']);
  });

  it('covers both delete reasons', () => {
    expect(DELETE_REASONS).toEqual(['self', 'admin']);
  });

  it('covers both presence statuses', () => {
    expect(PRESENCE_STATUSES).toEqual(['online', 'offline']);
  });
});
