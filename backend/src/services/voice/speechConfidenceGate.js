/**
 * File responsibility: ASR confidence and transcript gating.
 * Main responsibilities:
 * - Convert raw ASR confidence into simple UI-safe states.
 * - Keep thresholds centralised so calibration can be tuned later.
 * - Block unsafe realtime voice turns before they are saved as interview answers.
 */

const DEFAULT_THRESHOLDS = {
  high: 0.75,
  medium: 0.45,
};

const normalizeText = (value = '') => String(value || '').trim();
const countWords = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean).length;

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

export function validateRealtimeVoiceTranscript({ transcriptText = '', asrConfidence = null, vad = null } = {}) {
  const text = normalizeText(transcriptText);
  const words = countWords(text);
  const confidenceGate = buildConfidenceGate(asrConfidence);

  if (!text) {
    return {
      ok: false,
      reason: 'EMPTY_TRANSCRIPT',
      message: 'I did not catch your answer. Please try again.',
      confidenceGate,
    };
  }

  if (vad && (vad.isFinal === false || vad.final === false)) {
    return {
      ok: false,
      reason: 'NON_FINAL_VAD_TRANSCRIPT',
      message: 'Your answer still sounds incomplete. Please finish your answer before moving on.',
      confidenceGate,
    };
  }

  if (text.length < 8 || words < 2) {
    return {
      ok: false,
      reason: 'TOO_SHORT_TRANSCRIPT',
      message: 'I only caught a very short answer. Please say a little more before I move to the next question.',
      confidenceGate,
    };
  }

  if (confidenceGate.status === 'low' && (text.length < 24 || words < 4)) {
    return {
      ok: false,
      reason: 'LOW_CONFIDENCE_SHORT_TRANSCRIPT',
      message: 'I am not confident I heard that correctly. Please repeat your answer.',
      confidenceGate,
    };
  }

  return {
    ok: true,
    reason: 'VALID_TRANSCRIPT',
    message: null,
    confidenceGate,
  };
}
