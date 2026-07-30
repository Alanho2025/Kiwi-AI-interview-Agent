import { describe, expect, it, vi } from 'vitest';

import {
  listCandidateReflections,
  normalizeCandidateReflection,
  saveCandidateReflection,
} from '../../../src/services/report/candidateReportReflectionService.js';

describe('candidate report reflection service', () => {
  it('stores an explicitly candidate-provided private reflection without turning it into a score', async () => {
    const findOneAndUpdate = vi.fn().mockResolvedValue({});
    const entry = await saveCandidateReflection({
      sessionId: 'session-reflection',
      reflection: 'I described the tool but not how I verified the result.',
      focusArea: 'verification',
      model: { findOneAndUpdate },
    });

    expect(entry).toMatchObject({
      text: 'I described the tool but not how I verified the result.',
      focusArea: 'verification',
      source: 'candidate_provided',
    });
    expect(entry).not.toHaveProperty('score');
    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { sessionId: 'session-reflection' },
      expect.objectContaining({ $push: expect.objectContaining({ candidateReflectionRecords: expect.objectContaining({ $slice: -5 }) }) }),
      { new: true, upsert: false },
    );
  });

  it('rejects empty or oversized reflections and returns only recent private records', async () => {
    expect(() => normalizeCandidateReflection({ reflection: '' })).toThrow('A reflection is required');
    expect(() => normalizeCandidateReflection({ reflection: 'a'.repeat(801) })).toThrow('800 characters');
    const records = await listCandidateReflections({
      sessionId: 'session-reflection',
      model: { findOne: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue({ candidateReflectionRecords: [{ text: 'one' }, { text: 'two' }] }) }) },
    });
    expect(records).toEqual([{ text: 'one' }, { text: 'two' }]);
  });
});
