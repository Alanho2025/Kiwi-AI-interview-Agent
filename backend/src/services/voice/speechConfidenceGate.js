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

const DEFAULT_ACCEPTANCE_RULES = {
  minWords: 2,
  minCharacters: 8,
  mediumMinWords: 6,
  mediumMinSpeechMs: 2500,
  unknownMinWords: 8,
  unknownMinSpeechMs: 3500,
};

const normalizeText = (value = '') => String(value || '').trim();
const countWords = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean).length;
const getSpeechDurationMs = (vad = null) => {
  const duration = Number(vad?.speechDurationMs ?? vad?.durationMs ?? 0);
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
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

export function assessRealtimeVoiceTranscript({
  transcriptText = '',
  asrConfidence = null,
  vad = null,
  rules = DEFAULT_ACCEPTANCE_RULES,
} = {}) {
  const text = normalizeText(transcriptText);
  const words = countWords(text);
  const confidenceGate = buildConfidenceGate(asrConfidence);
  const speechDurationMs = getSpeechDurationMs(vad);
  const basePayload = {
    confidenceGate,
    metrics: {
      words,
      characters: text.length,
      speechDurationMs,
    },
  };

  if (!text) {
    return {
      ok: false,
      reason: 'EMPTY_TRANSCRIPT',
      message: 'I did not catch your answer. Please try again.',
      ...basePayload,
    };
  }

  if (vad && (vad.isFinal === false || vad.final === false)) {
    return {
      ok: false,
      reason: 'NON_FINAL_VAD_TRANSCRIPT',
      message: 'Your answer still sounds incomplete. Please finish your answer before moving on.',
      ...basePayload,
    };
  }

  if (text.length < rules.minCharacters || words < rules.minWords) {
    return {
      ok: false,
      reason: 'TOO_SHORT_TRANSCRIPT',
      message: 'I only caught a very short answer. Please say a little more before I move to the next question.',
      ...basePayload,
    };
  }

  if (confidenceGate.status === 'low') {
    return {
      ok: false,
      reason: 'LOW_CONFIDENCE_TRANSCRIPT',
      message: 'Voice recognition was not confident it heard that correctly. Please repeat your answer from the start.',
      ...basePayload,
    };
  }

  if (confidenceGate.status === 'medium' && (words < rules.mediumMinWords || speechDurationMs < rules.mediumMinSpeechMs)) {
    return {
      ok: false,
      reason: 'MEDIUM_CONFIDENCE_INSUFFICIENT_EVIDENCE',
      message: 'I only caught part of that. Please repeat your answer with a bit more detail.',
      ...basePayload,
    };
  }

  if (confidenceGate.status === 'unknown' && (words < rules.unknownMinWords || speechDurationMs < rules.unknownMinSpeechMs)) {
    return {
      ok: false,
      reason: 'UNKNOWN_CONFIDENCE_INSUFFICIENT_EVIDENCE',
      message: 'I need to hear that more clearly before I can continue. Please repeat your answer.',
      ...basePayload,
    };
  }

  return {
    ok: true,
    reason: 'VALID_TRANSCRIPT',
    message: null,
    ...basePayload,
  };
}

export function validateRealtimeVoiceTranscript({ transcriptText = '', asrConfidence = null, vad = null } = {}) {
  return assessRealtimeVoiceTranscript({ transcriptText, asrConfidence, vad });
}
