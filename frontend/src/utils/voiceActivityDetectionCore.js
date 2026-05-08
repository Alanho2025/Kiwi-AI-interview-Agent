export const DEFAULT_VAD_CONFIG = {
  speechThreshold: 0.018,
  silenceThreshold: 0.012,
  calibrationMs: 700,
  calibrationMaxRms: 0.022,
  noiseFloorMultiplier: 2,
  noiseFloorMargin: 0.006,
  speechStartConfirmationMs: 150,
  minSpeechMs: 1500,
  silenceToStopMs: 2000,
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
  let speechCandidateStartedAt = null;
  let calibrationSamples = [];
  let noiseFloor = null;

  const percentile = (values = [], target = 0.8) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * target)));
    return sorted[index];
  };

  const getThresholds = () => {
    const adaptiveSpeechThreshold = noiseFloor == null
      ? mergedConfig.speechThreshold
      : Math.max(
        mergedConfig.speechThreshold,
        noiseFloor * mergedConfig.noiseFloorMultiplier + mergedConfig.noiseFloorMargin
      );
    return {
      speechThreshold: adaptiveSpeechThreshold,
      silenceThreshold: Math.max(mergedConfig.silenceThreshold, adaptiveSpeechThreshold * 0.65),
      noiseFloor,
    };
  };

  const buildMetrics = (extra = {}) => ({
    ...extra,
    thresholds: getThresholds(),
    calibrationSamples: calibrationSamples.length,
  });

  const updateNoiseFloor = (rms, nowMs) => {
    const calibrationEndedAt = startedAt + mergedConfig.warmupIgnoreMs + mergedConfig.calibrationMs;
    const isCalibrationWindow = mergedConfig.calibrationMs > 0 && nowMs <= calibrationEndedAt;
    const isQuietCandidate = rms <= mergedConfig.calibrationMaxRms;
    if (isCalibrationWindow && isQuietCandidate) {
      calibrationSamples = [...calibrationSamples.slice(-40), rms];
      noiseFloor = percentile(calibrationSamples, 0.8);
    }
  };

  const start = (nowMs = 0) => {
    state = 'listening';
    startedAt = nowMs;
    speechStartedAt = null;
    lastSpeechAt = null;
    silenceStartedAt = null;
    speechCandidateStartedAt = null;
    calibrationSamples = [];
    noiseFloor = null;
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
      thresholds: getThresholds(),
    };
    state = 'idle';
    return { state, event: 'vad_stopped', metrics };
  };

  const update = (rms, nowMs) => {
    if (state === 'idle') return { state, event: null };
    if (nowMs - startedAt < mergedConfig.warmupIgnoreMs) return { state, event: 'warmup_ignored' };

    updateNoiseFloor(rms, nowMs);
    const thresholds = getThresholds();
    const isSpeech = rms >= thresholds.speechThreshold;
    const isSilence = rms <= thresholds.silenceThreshold;

    if (speechStartedAt == null && isSpeech) {
      if (speechCandidateStartedAt == null) speechCandidateStartedAt = nowMs;
      const confirmationMs = nowMs - speechCandidateStartedAt;
      if (confirmationMs < mergedConfig.speechStartConfirmationMs) {
        return { state, event: null, metrics: buildMetrics({ speechCandidateStartedAt, confirmationMs }) };
      }
      speechStartedAt = speechCandidateStartedAt;
      lastSpeechAt = nowMs;
      silenceStartedAt = null;
      state = 'user_speaking';
      return { state, event: 'speech_start', metrics: buildMetrics({ speechStartedAt, confirmationMs }) };
    }

    if (speechStartedAt == null) {
      if (!isSpeech) speechCandidateStartedAt = null;
      if (nowMs - startedAt >= mergedConfig.preSpeechGraceMs) {
        return { state, event: 'no_speech_timeout', metrics: buildMetrics({ waitedMs: nowMs - startedAt }) };
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
            thresholds,
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
          metrics: buildMetrics({
            speechStartedAt,
            speechEndedAt: lastSpeechAt || nowMs,
            silenceDetectedAt: nowMs,
            speechDurationMs,
            silenceDurationMs,
          }),
        };
      }
      return { state, event: null, metrics: buildMetrics({ speechDurationMs, silenceDurationMs }) };
    }

    return { state, event: null };
  };

  return {
    start,
    stop,
    update,
    getState: () => state,
    getRuntimeMetrics: () => buildMetrics({ state }),
    config: mergedConfig,
  };
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
