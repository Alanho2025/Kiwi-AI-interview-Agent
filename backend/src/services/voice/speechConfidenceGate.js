/**
 * File responsibility: ASR confidence and transcript gating.
 * Main responsibilities:
 * - Convert raw ASR confidence into simple UI-safe states.
 * - Keep thresholds centralised so calibration can be tuned later.
 * - Block unsafe realtime voice turns before they are saved as interview answers.
 */

import {
  DEFAULT_CONFIDENCE_THRESHOLDS,
  DEFAULT_ACCEPTANCE_RULES,
  FILLER_TRANSCRIPTS,
} from '../../config/speechConfidenceConfig.js';

import {
  normalizeText,
  countWords,
  getSpeechDurationMs,
  getSttSegmentCount,
  isFillerTranscript,
  hasContentfulLowConfidenceEvidence,
} from '../../utils/speechHelpers.js';

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

export function getConfidenceStatus(confidence, thresholds = DEFAULT_CONFIDENCE_THRESHOLDS) {
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

const MAX_CONFIRMATION_TURNS_PER_SESSION = 3;

export function assessRealtimeVoiceTranscript({
  transcriptText = '',
  asrConfidence = null,
  vad = null,
  rules = DEFAULT_ACCEPTANCE_RULES,
  sessionConfirmationCount = 0,
  riskSummary = null,
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

  if (isFillerTranscript(text, FILLER_TRANSCRIPTS)) {
    return traceGateDecision({
      ok: false,
      decision: 'reject',
      reason: 'FILLER_TRANSCRIPT',
      message: 'I only caught a filler response. Please answer the interview question in a full sentence.',
      ...basePayload,
    }, traceContext);
  }

  const needsConfirmation = confidenceGate.status === 'low' || Boolean(riskSummary?.requiresConfirmation);

  if (needsConfirmation) {
    const hasContentfulAnswer = hasContentfulLowConfidenceEvidence({
      words,
      characters: text.length,
      speechDurationMs,
      sttSegmentCount,
      rules,
    }) || Boolean(riskSummary?.technicalRiskSegmentCount > 0);

    if (hasContentfulAnswer) {
      if (sessionConfirmationCount >= MAX_CONFIRMATION_TURNS_PER_SESSION) {
        return traceGateDecision({
          ok: true,
          decision: 'accept',
          reason: 'MAX_CONFIRMATION_CAP_REACHED_PROVISIONAL_FALLBACK',
          message: null,
          provisional: true,
          ...basePayload,
        }, traceContext);
      }

      const confirmationConfidenceGate = {
        ...confidenceGate,
        shouldConfirm: true,
        shouldRecordAgain: false,
      };

      return traceGateDecision({
        ok: false,
        decision: 'confirm_understanding',
        reason: 'LOW_CONFIDENCE_CONTENTFUL_TRANSCRIPT',
        message: null,
        requiresUnderstandingConfirmation: true,
        shouldProcessAnswer: false,
        countsAsQuestion: false,
        isClarificationTurn: true,
        confidenceGate: confirmationConfidenceGate,
        metrics: basePayload.metrics,
        transcriptQuality: 'low_confidence_but_contentful',
      }, {
        ...traceContext,
        confidenceGate: confirmationConfidenceGate,
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
