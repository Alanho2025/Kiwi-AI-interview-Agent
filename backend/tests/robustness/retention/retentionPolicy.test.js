import { describe, expect, it } from 'vitest';
import {
  buildRetentionCutoff,
  isExpiredAtCutoff,
  partitionDocumentChunksByScope,
  partitionDocumentsByRetention,
  selectFixedSmokeBenchmarkCases,
  snapshotMatchesCandidate,
} from '../../../src/services/retention/retentionPolicy.js';

describe('retentionPolicy', () => {
  const cutoff = new Date('2026-06-12T12:00:00.000Z');

  it('treats the exact seven-day boundary as expired', () => {
    expect(buildRetentionCutoff(new Date('2026-06-19T12:00:00.000Z'), 7)).toEqual(cutoff);
    expect(isExpiredAtCutoff('2026-06-12T12:00:00.000Z', cutoff)).toBe(true);
    expect(isExpiredAtCutoff('2026-06-12T12:00:00.001Z', cutoff)).toBe(false);
    expect(isExpiredAtCutoff(null, cutoff)).toBe(false);
    expect(isExpiredAtCutoff('invalid', cutoff)).toBe(false);
  });

  it('never places missing or invalid timestamps into the deletion candidates', () => {
    const result = partitionDocumentsByRetention([
      { _id: 'expired', updatedAt: new Date('2026-06-12T12:00:00.000Z') },
      { _id: 'protected', updatedAt: new Date('2026-06-12T12:00:00.001Z') },
      { _id: 'missing' },
      { _id: 'invalid', updatedAt: 'not-a-date' },
    ], cutoff);

    expect(result.expired.map((item) => item._id)).toEqual(['expired']);
    expect(result.protected.map((item) => item._id)).toEqual(['protected']);
    expect(result.manualReview.map((item) => item._id)).toEqual(['missing', 'invalid']);
  });

  it('selects ten deterministic smoke cases per benchmark label', () => {
    const labels = ['empty', 'invalid', 'match', 'mismatch'];
    const cases = labels.flatMap((label) => Array.from({ length: 30 }, (_, index) => ({
      caseId: `${label}-${index}`,
      label,
    })));

    const selected = selectFixedSmokeBenchmarkCases(cases, { casesPerLabel: 10 });
    const selectedAgain = selectFixedSmokeBenchmarkCases([...cases].reverse(), { casesPerLabel: 10 });

    expect(selected).toHaveLength(40);
    expect(selected.map((item) => item.caseId)).toEqual(selectedAgain.map((item) => item.caseId));
    for (const label of labels) {
      expect(selected.filter((item) => item.label === label)).toHaveLength(10);
    }
  });

  it('skips a candidate whose timestamp changed after the audited snapshot', () => {
    const candidate = { id: 'document-1', updatedAt: '2026-06-01T00:00:00.000Z' };

    expect(snapshotMatchesCandidate(candidate, {
      _id: 'document-1',
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    })).toBe(true);
    expect(snapshotMatchesCandidate(candidate, {
      _id: 'document-1',
      updatedAt: new Date('2026-06-10T00:00:00.000Z'),
    })).toBe(false);
  });

  it('always protects global knowledge without a session identifier', () => {
    const result = partitionDocumentChunksByScope([
      { id: 'global-question', sessionId: null, sourceType: 'question_bank' },
      { id: 'global-jd', sessionId: null, sourceType: 'jd_library' },
      { id: 'expired-session', sessionId: 'session-old', sourceType: 'cv_profile' },
      { id: 'recent-session', sessionId: 'session-new', sourceType: 'transcript' },
    ], new Set(['session-old']));

    expect(result.protectedGlobal.map((item) => item.id)).toEqual(['global-question', 'global-jd']);
    expect(result.expiredSession.map((item) => item.id)).toEqual(['expired-session']);
    expect(result.protectedSession.map((item) => item.id)).toEqual(['recent-session']);
  });
});
