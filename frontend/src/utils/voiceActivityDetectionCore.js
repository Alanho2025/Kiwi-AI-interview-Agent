export const DEFAULT_VAD_CONFIG = {
  speechThreshold: 0.018,
  silenceThreshold: 0.012,
  minSpeechMs: 700,
  pauseCandidateMs: 1800,
  pauseConfirmMs: 800,
  silenceToStopMs: 2600,
  maxAnswerMs: 90000,
  preSpeechGraceMs: 5000,
  micArmDelayMs: 350,
  warmupIgnoreMs: 500,
  frameIntervalMs: 50,
};

const normalizeVadConfig = (config = {}) => {
  const merged = { ...DEFAULT_VAD_CONFIG, ...config };
  const pauseCandidateMs = Number.isFinite(merged.pauseCandidateMs)
    ? merged.pauseCandidateMs
    : Math.max(0, Number(merged.silenceToStopMs || DEFAULT_VAD_CONFIG.silenceToStopMs) - Number(merged.pauseConfirmMs || DEFAULT_VAD_CONFIG.pauseConfirmMs));
  const pauseConfirmMs = Number.isFinite(merged.pauseConfirmMs) ? merged.pauseConfirmMs : DEFAULT_VAD_CONFIG.pauseConfirmMs;
  return {
    ...merged,
    pauseCandidateMs,
    pauseConfirmMs,
    silenceToStopMs: Math.max(merged.silenceToStopMs || 0, pauseCandidateMs + pauseConfirmMs),
  };
};

export const createInitialVadMetrics = (startedAt = 0) => ({
  startedAt,
  speechStartedAt: null,
  speechEndedAt: null,
  silenceDetectedAt: null,
  pauseCandidateAt: null,
  pauseConfirmedAt: null,
  speechDurationMs: 0,
  silenceDurationMs: 0,
  usedPartialFallback: false,
});

export function createVoiceActivityStateMachine(config = {}) {
  const mergedConfig = normalizeVadConfig(config);
  let state = 'idle';
  let startedAt = 0;
  let speechStartedAt = null;
  let lastSpeechAt = null;
  let silenceStartedAt = null;
  let pauseCandidateEmitted = false;

  const buildSilenceMetrics = (nowMs) => {
    const speechDurationMs = lastSpeechAt ? Math.max(0, lastSpeechAt - speechStartedAt) : Math.max(0, nowMs - speechStartedAt);
    const silenceDurationMs = silenceStartedAt ? Math.max(0, nowMs - silenceStartedAt) : 0;
    return {
      speechStartedAt,
      speechEndedAt: lastSpeechAt || nowMs,
      silenceDetectedAt: nowMs,
      pauseCandidateAt: pauseCandidateEmitted ? silenceStartedAt : null,
      pauseConfirmedAt: nowMs,
      speechDurationMs,
      silenceDurationMs,
      pauseCandidateMs: mergedConfig.pauseCandidateMs,
      pauseConfirmMs: mergedConfig.pauseConfirmMs,
      silenceToStopMs: mergedConfig.silenceToStopMs,
    };
  };

  const start = (nowMs = 0) => {
    state = 'listening';
    startedAt = nowMs;
    speechStartedAt = null;
    lastSpeechAt = null;
    silenceStartedAt = null;
    pauseCandidateEmitted = false;
    return { state, event: 'vad_started' };
  };

  const stop = (nowMs = 0) => {
    const metrics = {
      startedAt,
      speechStartedAt,
      speechEndedAt: nowMs,
      silenceDetectedAt: nowMs,
      speechDurationMs: speechStartedAt ? Math.max(0, nowMs - speechStartedAt) : 0,
      silenceDurationMs: silenceStartedAt ? Math.max(0, nowMs - silenceStartedAt) : 0,
      pauseCandidateMs: mergedConfig.pauseCandidateMs,
      pauseConfirmMs: mergedConfig.pauseConfirmMs,
      silenceToStopMs: mergedConfig.silenceToStopMs,
    };
    state = 'idle';
    return { state, event: 'vad_stopped', metrics };
  };

  const update = (rms, nowMs) => {
    if (state === 'idle') return { state, event: null };
    if (nowMs - startedAt < mergedConfig.warmupIgnoreMs) return { state, event: 'warmup_ignored' };

    const isSpeech = rms >= mergedConfig.speechThreshold;
    const isSilence = rms <= mergedConfig.silenceThreshold;

    if (speechStartedAt == null && isSpeech) {
      speechStartedAt = nowMs;
      lastSpeechAt = nowMs;
      silenceStartedAt = null;
      pauseCandidateEmitted = false;
      state = 'user_speaking';
      return { state, event: 'speech_start', metrics: { speechStartedAt } };
    }

    if (speechStartedAt == null) {
      if (nowMs - startedAt >= mergedConfig.preSpeechGraceMs) {
        return { state, event: 'no_speech_timeout', metrics: { waitedMs: nowMs - startedAt } };
      }
      return { state, event: null };
    }

    if (isSpeech) {
      const previousState = state;
      lastSpeechAt = nowMs;
      silenceStartedAt = null;
      state = 'user_speaking';
      const wasPaused = pauseCandidateEmitted || previousState === 'pause_detected';
      pauseCandidateEmitted = false;
      if (nowMs - speechStartedAt >= mergedConfig.maxAnswerMs) {
        return {
          state,
          event: 'max_answer_timeout',
          metrics: {
            speechStartedAt,
            speechEndedAt: nowMs,
            speechDurationMs: nowMs - speechStartedAt,
          },
        };
      }
      if (wasPaused) {
        return {
          state,
          event: 'pause_resumed',
          metrics: { speechStartedAt, resumedAt: nowMs },
        };
      }
      return { state, event: null };
    }

    if (isSilence) {
      if (silenceStartedAt == null) silenceStartedAt = nowMs;
      const metrics = buildSilenceMetrics(nowMs);
      state = pauseCandidateEmitted ? 'pause_detected' : 'detecting_silence';

      if (metrics.speechDurationMs >= mergedConfig.minSpeechMs && !pauseCandidateEmitted && metrics.silenceDurationMs >= mergedConfig.pauseCandidateMs) {
        pauseCandidateEmitted = true;
        state = 'pause_detected';
        return { state, event: 'pause_candidate_start', metrics: { ...metrics, pauseCandidateAt: nowMs } };
      }

      if (metrics.speechDurationMs >= mergedConfig.minSpeechMs && metrics.silenceDurationMs >= mergedConfig.silenceToStopMs) {
        state = 'pause_confirmed';
        return { state, event: 'speech_end', metrics };
      }

      return { state, event: null, metrics };
    }

    return { state, event: null };
  };

  return { start, stop, update, getState: () => state, config: mergedConfig };
}

export function selectBestTranscript({ finalTranscript, partialTranscript, timeoutUsed = false }) {
  const finalText = String(finalTranscript?.displayText || finalTranscript?.normalizedText || finalTranscript?.rawText || '').trim();
  if (finalText) {
    return { ...finalTranscript, displayText: finalText, source: 'final', usedPartialFallback: false };
  }

  const partialText = String(partialTranscript || '').trim();
  if (partialText) {
    return {
      type: 'final_transcript',
      displayText: partialText,
      normalizedText: partialText,
      rawText: partialText,
      confidence: null,
      confidenceStatus: timeoutUsed ? 'partial_fallback_timeout' : 'partial_fallback',
      source: 'partial_fallback',
      fallback: true,
      usedPartialFallback: true,
    };
  }

  return null;
}
