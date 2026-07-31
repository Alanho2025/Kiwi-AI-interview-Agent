/**
 * File responsibility: Deterministic Dual-Dimension Transcript Trust Status Resolver.
 * Main responsibilities:
 * - Output transcriptTrustStatus: 'Trusted' | 'Calibrated' | 'Provisional' | 'Uncertain'
 * - Output confirmationStatus: 'Confirmed' | 'Pending' | 'Bypassed' | 'Unconfirmed'
 * - Provide clean UI & PDF badge metadata ('[Provisional / 待人工確認]')
 * - Strictly deterministic, zero LLM dependency, zero cost.
 */

export const TRANSCRIPT_TRUST_STATUS = Object.freeze({
  TRUSTED: 'Trusted',
  CALIBRATED: 'Calibrated',
  PROVISIONAL: 'Provisional',
  UNCERTAIN: 'Uncertain',
});

export const CONFIRMATION_STATUS = Object.freeze({
  CONFIRMED: 'Confirmed',
  PENDING: 'Pending',
  BYPASSED: 'Bypassed',
  UNCONFIRMED: 'Unconfirmed',
});

export const resolveAnswerTranscriptTrustStatus = ({
  turn = null,
  confidence = null,
  riskSummary = null,
  calibration = null,
  gateAssessment = null,
  userConfirmed = false,
  sessionConfirmationCount = 0,
} = {}) => {
  const effectiveConfidence = Number(
    confidence?.stt
    ?? confidence
    ?? turn?.confidence?.stt
    ?? turn?.confidence
    ?? gateAssessment?.confidenceGate?.confidence
    ?? 1.0,
  );

  const isProvisionalGate = Boolean(
    gateAssessment?.provisional
    || gateAssessment?.reason === 'MAX_CONFIRMATION_CAP_REACHED_PROVISIONAL_FALLBACK'
    || sessionConfirmationCount >= 3,
  );

  const hasHighRisk = Boolean(
    riskSummary?.riskLevel === 'high'
    || riskSummary?.technicalRiskSegmentCount > 0
    || turn?.termCorruption,
  );

  const isCalibrated = Boolean(
    calibration?.decisionType === 'nbest_rerank'
    || calibration?.decisionType === 'static_normalization'
    || (Array.isArray(calibration?.corrections) && calibration.corrections.length > 0),
  );

  if (userConfirmed || turn?.userConfirmed) {
    return {
      transcriptTrustStatus: TRANSCRIPT_TRUST_STATUS.TRUSTED,
      confirmationStatus: CONFIRMATION_STATUS.CONFIRMED,
      badge: {
        show: false,
        label: 'Confirmed',
        code: 'confirmed',
      },
    };
  }

  if (isProvisionalGate || (hasHighRisk && !userConfirmed)) {
    return {
      transcriptTrustStatus: TRANSCRIPT_TRUST_STATUS.PROVISIONAL,
      confirmationStatus: CONFIRMATION_STATUS.BYPASSED,
      badge: {
        show: true,
        label: 'Provisional / 待人工確認',
        code: 'provisional',
        color: 'amber',
        tooltip: 'ASR high-risk or max confirmation cap reached; answer preserved provisionally.',
      },
    };
  }

  if (isCalibrated) {
    return {
      transcriptTrustStatus: TRANSCRIPT_TRUST_STATUS.CALIBRATED,
      confirmationStatus: CONFIRMATION_STATUS.BYPASSED,
      badge: {
        show: false,
        label: 'Calibrated',
        code: 'calibrated',
      },
    };
  }

  if (effectiveConfidence >= 0.80) {
    return {
      transcriptTrustStatus: TRANSCRIPT_TRUST_STATUS.TRUSTED,
      confirmationStatus: CONFIRMATION_STATUS.BYPASSED,
      badge: {
        show: false,
        label: 'Trusted',
        code: 'trusted',
      },
    };
  }

  return {
    transcriptTrustStatus: TRANSCRIPT_TRUST_STATUS.UNCERTAIN,
    confirmationStatus: CONFIRMATION_STATUS.UNCONFIRMED,
    badge: {
      show: true,
      label: 'Uncertain / 待確認',
      code: 'uncertain',
      color: 'slate',
      tooltip: 'Low ASR confidence evidence.',
    },
  };
};
