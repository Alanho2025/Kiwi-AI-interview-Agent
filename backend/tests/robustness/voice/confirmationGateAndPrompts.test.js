/**
 * File responsibility: Phase 4 Realtime Confirmation Safety Gate & Dialogue Grounding Test Suite.
 * Main responsibilities:
 * - Test 2-level confirmation prompt generation (specific for strong single match, neutral for weak/ambiguous).
 * - Verify Confirmation Frequency Cap (max 3 per session, fallback to Provisional).
 * - Confirm non-scoring repair turn status (countsAsQuestion = false).
 */

import { describe, expect, it } from 'vitest';

import {
  buildTwoLevelTranscriptConfirmationPrompt,
} from '../../../src/services/voice/transcriptUnderstandingSummary.js';
import {
  assessRealtimeVoiceTranscript,
} from '../../../src/services/voice/speechConfidenceGate.js';

describe('Phase 4: Realtime Confirmation Safety Gate & Dialogue Grounding', () => {
  it('generates specific term prompt for strong single term match', () => {
    const prompt = buildTwoLevelTranscriptConfirmationPrompt({
      transcriptText: 'We processed data breaks on AWS',
      termCorruption: { candidateTerm: 'Databricks', matchStrength: 'strong' },
      matchStrength: 'strong',
      ambiguityCount: 1,
    });

    expect(prompt).toBe("Just to confirm, did you mean 'Databricks'?");
  });

  it('generates neutral restatement prompt for weak or ambiguous matches to avoid Answer Priming', () => {
    const promptAmbiguous = buildTwoLevelTranscriptConfirmationPrompt({
      transcriptText: 'We used some tools',
      termCorruption: { candidateTerm: 'Databricks', matchStrength: 'weak' },
      matchStrength: 'weak',
      ambiguityCount: 2,
    });

    expect(promptAmbiguous).toBe('I may have misheard one tool or system name. Could you briefly repeat the specific tool or technology name?');
  });

  it('triggers confirm_understanding when sessionConfirmationCount is below max cap of 3', () => {
    const assessment = assessRealtimeVoiceTranscript({
      transcriptText: 'I used data breaks on AWS for large datasets',
      asrConfidence: 0.35,
      vad: { isFinal: true, speechDurationMs: 4000, sttSegmentCount: 1 },
      riskSummary: { requiresConfirmation: true, technicalRiskSegmentCount: 1 },
      sessionConfirmationCount: 1,
    });

    expect(assessment.ok).toBe(false);
    expect(assessment.decision).toBe('confirm_understanding');
    expect(assessment.countsAsQuestion).toBe(false);
    expect(assessment.isClarificationTurn).toBe(true);
  });

  it('falls back to provisional accept when sessionConfirmationCount hits max cap of 3 to protect dialogue flow', () => {
    const assessment = assessRealtimeVoiceTranscript({
      transcriptText: 'I used data breaks on AWS for large datasets',
      asrConfidence: 0.35,
      vad: { isFinal: true, speechDurationMs: 4000, sttSegmentCount: 1 },
      riskSummary: { requiresConfirmation: true, technicalRiskSegmentCount: 1 },
      sessionConfirmationCount: 3, // Max cap reached
    });

    expect(assessment.ok).toBe(true);
    expect(assessment.decision).toBe('accept');
    expect(assessment.reason).toBe('MAX_CONFIRMATION_CAP_REACHED_PROVISIONAL_FALLBACK');
    expect(assessment.provisional).toBe(true);
  });
});
