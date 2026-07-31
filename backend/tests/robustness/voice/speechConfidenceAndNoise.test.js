import { describe, expect, it } from 'vitest';
import { validateRealtimeVoiceTranscript } from '../../../src/services/voice/speechConfidenceGate.js';

describe('2. speechConfidenceAndNoise: Speech confidence & noise safeguards', () => {
  it('rejects short noise / filler speech and triggers repair prompt without scoring', () => {
    const result = validateRealtimeVoiceTranscript({
      transcriptText: 'Uhm',
      asrConfidence: 0.1,
      vad: { speechDurationMs: 500, sttSegmentCount: 1, isFinal: true },
    });

    expect(result.ok).toBe(false);
    expect(result.decision).toBe('reject');
    expect(result.reason).toBe('TOO_SHORT_TRANSCRIPT');
    expect(result.countsAsQuestion).toBeUndefined();
  });

  it('triggers transcript confirmation for contentful low-confidence speech without advancing question count', () => {
    const result = validateRealtimeVoiceTranscript({
      transcriptText: 'I compared MongoDB and PostgreSQL because the interview agent stores flexible CV text, job descriptions, transcript records, match analysis, and structured user account data. I chose the database based on query needs, schema flexibility, and validation requirements.',
      asrConfidence: 0.24,
      vad: { speechDurationMs: 42000, sttSegmentCount: 3, isFinal: true },
    });

    expect(result.ok).toBe(false);
    expect(result.decision).toBe('confirm_understanding');
    expect(result.requiresUnderstandingConfirmation).toBe(true);
    expect(result.countsAsQuestion).toBe(false);
    expect(result.shouldProcessAnswer).toBe(false);
  });
});
