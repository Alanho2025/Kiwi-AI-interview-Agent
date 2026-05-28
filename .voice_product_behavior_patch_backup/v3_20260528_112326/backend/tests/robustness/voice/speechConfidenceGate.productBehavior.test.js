import { describe, expect, it } from 'vitest';
import { validateRealtimeVoiceTranscript } from '../../../src/services/voice/speechConfidenceGate.js';

describe('speech confidence gate product behavior', () => {
  it('rejects short low-confidence transcripts', () => {
    const result = validateRealtimeVoiceTranscript({
      transcriptText: 'React',
      asrConfidence: 0.2,
      vad: { speechDurationMs: 1200, sttSegmentCount: 1, isFinal: true },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      decision: 'reject',
      reason: 'LOW_CONFIDENCE_TRANSCRIPT',
    }));
  });

  it('requests confirmation for contentful low-confidence transcripts', () => {
    const result = validateRealtimeVoiceTranscript({
      transcriptText: 'I compared MongoDB and PostgreSQL because the interview agent stores flexible CV text, job descriptions, transcript records, match analysis, and structured user account data. I chose the database based on query needs, schema flexibility, and validation requirements.',
      asrConfidence: 0.24,
      vad: { speechDurationMs: 42000, sttSegmentCount: 3, isFinal: true },
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      decision: 'confirm_understanding',
      reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
      requiresUnderstandingConfirmation: true,
      countsAsQuestion: false,
      transcriptQuality: 'low_confidence_but_contentful',
    }));
  });
});
