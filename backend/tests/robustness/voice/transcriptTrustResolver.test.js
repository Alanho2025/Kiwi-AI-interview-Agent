/**
 * File responsibility: Phase 5 Dual-Dimension Transcript Trust Resolver Test Suite.
 * Main responsibilities:
 * - Test deterministic trust status resolution (Trusted, Calibrated, Provisional, Uncertain).
 * - Verify confirmation status output (Confirmed, Pending, Bypassed, Unconfirmed).
 * - Ensure Provisional badge metadata is generated correctly for report UI & PDF without re-eval actions.
 */

import { describe, expect, it } from 'vitest';

import {
  resolveAnswerTranscriptTrustStatus,
  TRANSCRIPT_TRUST_STATUS,
  CONFIRMATION_STATUS,
} from '../../../src/services/voice/transcriptTrustResolverService.js';

describe('Phase 5: Deterministic Dual-Dimension Transcript Trust Resolver', () => {
  it('resolves Trusted status when candidate explicitly confirmed the transcript', () => {
    const result = resolveAnswerTranscriptTrustStatus({
      userConfirmed: true,
      confidence: 0.60,
    });

    expect(result.transcriptTrustStatus).toBe(TRANSCRIPT_TRUST_STATUS.TRUSTED);
    expect(result.confirmationStatus).toBe(CONFIRMATION_STATUS.CONFIRMED);
    expect(result.badge.show).toBe(false);
  });

  it('resolves Provisional status with UI badge when confirmation cap hit or high risk present', () => {
    const resultCapHit = resolveAnswerTranscriptTrustStatus({
      sessionConfirmationCount: 3, // Max cap reached
      confidence: 0.50,
    });

    expect(resultCapHit.transcriptTrustStatus).toBe(TRANSCRIPT_TRUST_STATUS.PROVISIONAL);
    expect(resultCapHit.confirmationStatus).toBe(CONFIRMATION_STATUS.BYPASSED);
    expect(resultCapHit.badge.show).toBe(true);
    expect(resultCapHit.badge.label).toBe('Provisional / 待人工確認');
  });

  it('resolves Calibrated status when N-Best rerank or static normalization succeeded', () => {
    const resultCalibrated = resolveAnswerTranscriptTrustStatus({
      calibration: { decisionType: 'nbest_rerank', corrections: [{ glossaryTerm: 'Databricks' }] },
      confidence: 0.75,
    });

    expect(resultCalibrated.transcriptTrustStatus).toBe(TRANSCRIPT_TRUST_STATUS.CALIBRATED);
    expect(resultCalibrated.confirmationStatus).toBe(CONFIRMATION_STATUS.BYPASSED);
  });

  it('resolves Trusted status for high STT confidence answers without risk', () => {
    const resultTrusted = resolveAnswerTranscriptTrustStatus({
      confidence: 0.92,
      riskSummary: { technicalRiskSegmentCount: 0, riskLevel: 'low' },
    });

    expect(resultTrusted.transcriptTrustStatus).toBe(TRANSCRIPT_TRUST_STATUS.TRUSTED);
    expect(resultTrusted.confirmationStatus).toBe(CONFIRMATION_STATUS.BYPASSED);
  });
});
