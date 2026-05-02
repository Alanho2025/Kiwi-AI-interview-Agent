export const DEFAULT_VAD_CONFIG = {
  speechThreshold: 0.018,
  silenceThreshold: 0.012,
  minSpeechMs: 1500,
  silenceToStopMs: 3000,
  maxAnswerMs: 240000,
  preSpeechGraceMs: 15000,
  micArmDelayMs: 350,
  warmupIgnoreMs: 500,
  frameIntervalMs: 50,
};

export const createInitialVadMetrics = (startedAt = 0) => ({
  startedAt,
  speechStartedAt: null,
  speechEndedAt: null,
  silenceDetectedAt: null,
  speechDurationMs: 0,
  silenceDurationMs: 0,
  usedPartialFallback: false,
});

export function createVoiceActivityStateMachine(config = {}) {
  const mergedConfig = { ...DEFAULT_VAD_CONFIG, ...config };
  let state = 'idle';
  let startedAt = 0;
  let speechStartedAt = null;
  let lastSpeechAt = null;
  let silenceStartedAt = null;

  const start = (nowMs = 0) => {
    state = 'listening';
    startedAt = nowMs;
    speechStartedAt = null;
    lastSpeechAt = null;
    silenceStartedAt = null;
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
      lastSpeechAt = nowMs;
      silenceStartedAt = null;
      state = 'user_speaking';
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
      return { state, event: null };
    }

    if (isSilence) {
      if (silenceStartedAt == null) silenceStartedAt = nowMs;
      state = 'detecting_silence';
      const speechDurationMs = lastSpeechAt ? lastSpeechAt - speechStartedAt : nowMs - speechStartedAt;
      const silenceDurationMs = nowMs - silenceStartedAt;
      if (speechDurationMs >= mergedConfig.minSpeechMs && silenceDurationMs >= mergedConfig.silenceToStopMs) {
        return {
          state,
          event: 'speech_end',
          metrics: {
            speechStartedAt,
            speechEndedAt: lastSpeechAt || nowMs,
            silenceDetectedAt: nowMs,
            speechDurationMs,
            silenceDurationMs,
          },
        };
      }
      return { state, event: null, metrics: { speechDurationMs, silenceDurationMs } };
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
