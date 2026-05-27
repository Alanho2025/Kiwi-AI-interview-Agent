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
  minAcceptedSpeechMs: 900,
  mediumMinWords: 6,
  mediumMinSpeechMs: 2500,
  unknownMinWords: 8,
  unknownMinSpeechMs: 3500,
  lowConfidenceContentfulMinWords: 25,
  lowConfidenceContentfulMinCharacters: 120,
  lowConfidenceContentfulMinSpeechMs: 8000,
  contentfulLowConfidenceMinWords: 25,
  contentfulLowConfidenceMinCharacters: 120,
  contentfulLowConfidenceMinSpeechMs: 8000,
};

const normalizeText = (value = '') => String(value || '').trim();
const countWords = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean).length;
const normalizeForFillerCheck = (value = '') => normalizeText(value).toLowerCase().replace(/[^\w\s']/g, '').replace(/\s+/g, ' ');
const getSpeechDurationMs = (vad = null) => {
  const duration = Number(vad?.speechDurationMs ?? vad?.durationMs ?? 0);
  return Number.isFinite(duration) ? Math.max(0, duration) : 0;
};
const getSttSegmentCount = (vad = null) => {
  const segmentCount = Number(vad?.sttSegmentCount);
  return Number.isFinite(segmentCount) ? segmentCount : null;
};

const FILLER_TRANSCRIPTS = new Set([
  'ok',
  'okay',
  'yeah',
  'yes',
  'yep',
  'no',
  'nope',
  'hello',
  'hi',
  'um',
  'uh',
  'thanks',
  'thank you',
]);

const isFillerTranscript = (value = '') => FILLER_TRANSCRIPTS.has(normalizeForFillerCheck(value));

const hasContentfulLowConfidenceEvidence = ({ words, characters, speechDurationMs, sttSegmentCount, rules }) => {
  const hasEnoughText = words >= rules.contentfulLowConfidenceMinWords
    && characters >= rules.contentfulLowConfidenceMinCharacters;
  const hasEnoughSpeech = speechDurationMs >= rules.contentfulLowConfidenceMinSpeechMs;
  const hasFinalSpeechEvidence = sttSegmentCount === null || sttSegmentCount > 0;
  return hasEnoughText && hasEnoughSpeech && hasFinalSpeechEvidence;
};

const traceGateDecision = (decision, context = {}) => {
  // Intentionally console-based because this helper is pure and has no request logger.
  // Backend runtime logs will include this in local/Render output.
  console.info('[VOICE-CONFIDENCE-GATE-TRACE]', {
    decision,
    at: new Date().toISOString(),
    ...context,
  });
  return decision;
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
  const sttSegmentCount = getSttSegmentCount(vad);
  const basePayload = {
    confidenceGate,
    metrics: {
      words,
      characters: text.length,
      speechDurationMs,
      sttSegmentCount,
    },
  };
  const traceContext = {
    transcriptText: text,
    asrConfidence,
    vad,
    rules,
    confidenceGate,
    metrics: basePayload.metrics,
  };

  if (!text) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'EMPTY_TRANSCRIPT',
      message: 'I did not catch your answer. Please try again.',
      ...basePayload,
    }, traceContext);
  }

  if (vad && (vad.isFinal === false || vad.final === false)) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'NON_FINAL_VAD_TRANSCRIPT',
      message: 'Your answer still sounds incomplete. Please finish your answer before moving on.',
      ...basePayload,
    }, traceContext);
  }

  if (sttSegmentCount === 0) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'NO_FINAL_STT_SEGMENTS',
      message: 'I did not catch your answer clearly. Please try again.',
      ...basePayload,
    }, traceContext);
  }

  if (text.length < rules.minCharacters || words < rules.minWords) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'TOO_SHORT_TRANSCRIPT',
      message: 'I only caught a very short answer. Please say a little more before I move to the next question.',
      ...basePayload,
    }, traceContext);
  }

  if (vad && speechDurationMs > 0 && speechDurationMs < rules.minAcceptedSpeechMs) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'SPEECH_TOO_SHORT',
      message: 'I only heard a brief sound. Please give your full answer before I move on.',
      ...basePayload,
    }, traceContext);
  }

  if (isFillerTranscript(text)) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'FILLER_TRANSCRIPT',
      message: 'I only caught a filler response. Please answer the interview question in a full sentence.',
      ...basePayload,
    }, traceContext);
  }

  if (confidenceGate.status === 'low') {
    const hasContentfulAnswer = words >= rules.lowConfidenceContentfulMinWords
      && text.length >= rules.lowConfidenceContentfulMinCharacters
      && speechDurationMs >= rules.lowConfidenceContentfulMinSpeechMs
      && (sttSegmentCount === null || sttSegmentCount > 0);

    if (hasContentfulAnswer) {
      const contentfulConfidenceGate = {
        ...confidenceGate,
        shouldConfirm: true,
        shouldRecordAgain: false,
      };

      return traceGateDecision({
        ok: true,
        reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
        message: 'I may not have heard every word perfectly, but I caught enough of your answer to continue.',
        confidenceGate: contentfulConfidenceGate,
        metrics: basePayload.metrics,
        transcriptQuality: 'low_confidence_but_contentful',
        shouldUseCautiousScoring: true,
      }, {
        ...traceContext,
        confidenceGate: contentfulConfidenceGate,
      });
    }

    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'LOW_CONFIDENCE_TRANSCRIPT',
      message: 'Voice recognition was not confident it heard that correctly. Please repeat your answer from the start.',
      ...basePayload,
    }, traceContext);
  }

  if (confidenceGate.status === 'medium' && (words < rules.mediumMinWords || speechDurationMs < rules.mediumMinSpeechMs)) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'MEDIUM_CONFIDENCE_INSUFFICIENT_EVIDENCE',
      message: 'I only caught part of that. Please repeat your answer with a bit more detail.',
      ...basePayload,
    }, traceContext);
  }

  if (confidenceGate.status === 'unknown' && (words < rules.unknownMinWords || speechDurationMs < rules.unknownMinSpeechMs)) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'UNKNOWN_CONFIDENCE_INSUFFICIENT_EVIDENCE',
      message: 'I need to hear that more clearly before I can continue. Please repeat your answer.',
      ...basePayload,
    }, traceContext);
  }

  return traceGateDecision({
    ok: true,
    decision: 'accept',
    reason: 'VALID_TRANSCRIPT',
    message: null,
    ...basePayload,
  }, traceContext);
}

export function validateRealtimeVoiceTranscript({ transcriptText = '', asrConfidence = null, vad = null } = {}) {
  return assessRealtimeVoiceTranscript({ transcriptText, asrConfidence, vad });
}
