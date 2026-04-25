/**
 * File responsibility: ASR confidence gating.
 * Main responsibilities:
 * - Convert raw ASR confidence into simple UI-safe states.
 * - Keep thresholds centralised so calibration can be tuned later.
 */

const DEFAULT_THRESHOLDS = {
  high: 0.75,
  medium: 0.45,
};

export function getConfidenceStatus(confidence, thresholds = DEFAULT_THRESHOLDS) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) {
    return 'unknown';
  }
  if (confidence >= thresholds.high) return 'high';
  if (confidence >= thresholds.medium) return 'medium';
  return 'low';
}

export function buildConfidenceGate(confidence) {
  const status = getConfidenceStatus(confidence);
  const shouldConfirm = status !== 'high';
  const shouldRecordAgain = status === 'low';
  return { status, shouldConfirm, shouldRecordAgain };
}
