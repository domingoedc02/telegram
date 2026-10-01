import { describe, expect, it } from 'vitest';

import {
  errorEnvelopeSchema,
  listEnvelopeSchema,
  messageSchema,
  syncResponseSchema,
  userSchema,
} from './index.js';

const sampleUser = {
  id: '9f0e1234-0000-4000-8000-000000000001',
  email: 'member@example.test',
  name: 'Member One',
  role: 'member',
  deactivatedAt: null,
  createdAt: '2026-10-01T09:00:00.000Z',
};

// Round-trips the exact `message` example from spec/api's "Request/response
// shapes" section, so a future drift between this schema and the documented
// contract fails a test rather than surfacing as a runtime bug. (Full
// structural comparison against apps/server's Drizzle row type lands once
// TG-2's schema exists — tracked as a follow-up, not blocking this issue.)
const sampleMessage = {
  id: 'b3d10000-0000-4000-8000-000000000002',
  conversationId: 'a1c20000-0000-4000-8000-000000000003',
  seq: 104822,
  senderId: '9f0e1234-0000-4000-8000-000000000001',
  body: 'sounds good',
  threadRootId: null,
  replyCount: 3,
  lastReplyAt: '2026-10-01T09:04:00.000Z',
  editedAt: null,
  deletedAt: null,
  createdAt: '2026-10-01T09:00:00.000Z',
  clientMessageId: 'b7a90000-0000-4000-8000-000000000004',
};

describe('dto schemas', () => {
  it('accepts a well-formed user', () => {
    expect(userSchema.parse(sampleUser)).toEqual(sampleUser);
  });

  it("accepts spec/api's documented message example verbatim", () => {
    expect(messageSchema.parse(sampleMessage)).toEqual(sampleMessage);
  });

  it('rejects a message missing a required field', () => {
    const withoutSeq: Partial<typeof sampleMessage> = { ...sampleMessage };
    delete withoutSeq.seq;
    expect(messageSchema.safeParse(withoutSeq).success).toBe(false);
  });

  it('parses the error envelope shape, with optional details', () => {
    const parsed = errorEnvelopeSchema.parse({
      error: {
        code: 'LAST_ADMIN',
        message: 'cannot demote the last admin',
        details: { foo: 'bar' },
      },
    });
    expect(parsed.error.code).toBe('LAST_ADMIN');
  });

  it('parses the list envelope for an arbitrary item schema', () => {
    const schema = listEnvelopeSchema(userSchema);
    const parsed = schema.parse({ data: [sampleUser], meta: { nextCursor: null, hasMore: false } });
    expect(parsed.data).toHaveLength(1);
  });

  it('parses the /sync response shape ({messages, meta}, not {data, meta})', () => {
    const parsed = syncResponseSchema.parse({
      messages: [sampleMessage],
      meta: { nextCursor: null, hasMore: false },
    });
    expect(parsed.messages[0]?.id).toBe(sampleMessage.id);
  });
});
