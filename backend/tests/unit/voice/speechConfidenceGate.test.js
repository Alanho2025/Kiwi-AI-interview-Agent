import { describe, expect, it } from 'vitest';
import { buildConfidenceGate, getConfidenceStatus } from '../../../src/services/voice/speechConfidenceGate.js';

describe('speech confidence gate', () => {
  it('maps numeric confidence to high, medium, and low states', () => {
    expect(getConfidenceStatus(0.92)).toBe('high');
    expect(getConfidenceStatus(0.55)).toBe('medium');
    expect(getConfidenceStatus(0.2)).toBe('low');
  });

  it('treats missing confidence conservatively', () => {
    expect(getConfidenceStatus(null)).toBe('unknown');
    expect(buildConfidenceGate(null)).toEqual({
      status: 'unknown',
      shouldConfirm: true,
      shouldRecordAgain: false,
    });
  });

  it('asks the user to record again for low confidence transcripts', () => {
    expect(buildConfidenceGate(0.2)).toEqual({
      status: 'low',
      shouldConfirm: true,
      shouldRecordAgain: true,
    });
  });
});
