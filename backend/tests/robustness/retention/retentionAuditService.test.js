import { describe, expect, it } from 'vitest';
import {
  buildMongoGlobalKnowledgeSummary,
  classifyMongoDocument,
} from '../../../src/services/retention/retentionAuditService.js';

describe('retentionAuditService classification', () => {
  const input = {
    collectionName: 'documentchunks',
    cutoff: new Date('2026-06-12T00:00:00.000Z'),
    smokeCaseIds: new Set(),
    expiredSessionIds: new Set(['expired-session']),
  };

  it('never classifies global Mongo knowledge as a deletion candidate', () => {
    expect(classifyMongoDocument({
      ...input,
      document: { _id: 'global-1', sessionId: null, updatedAt: new Date('2020-01-01') },
    })).toBeNull();
  });

  it('only classifies legacy mirror chunks linked to an expired session', () => {
    expect(classifyMongoDocument({
      ...input,
      document: { _id: 'chunk-1', sessionId: 'expired-session', updatedAt: new Date('2020-01-01') },
    })).toBe('expired_session_legacy_mirror');
    expect(classifyMongoDocument({
      ...input,
      document: { _id: 'chunk-2', sessionId: 'active-session', updatedAt: new Date('2020-01-01') },
    })).toBeNull();
  });

  it('builds a separate checksum containing every global Mongo knowledge chunk', () => {
    const summary = buildMongoGlobalKnowledgeSummary([
      { _id: 'global-1', updatedAt: new Date('2026-01-01') },
      { _id: 'global-2', sessionId: null, updatedAt: new Date('2026-01-02') },
      { _id: 'session-1', sessionId: 'active-session', updatedAt: new Date('2026-01-03') },
    ]);

    expect(summary.count).toBe(2);
    expect(summary.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
