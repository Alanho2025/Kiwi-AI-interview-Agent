const formatMs = (value) => {
  if (value == null || Number.isNaN(Number(value))) return 'n/a';
  return `${Math.round(Number(value))} ms`;
};

export const buildVoiceLatencyConsoleSummary = ({ trace = null, backendLatency = null } = {}) => {
  const derived = trace?.derived || {};
  return {
    clientStopToSubmit: formatMs(derived.stopToSubmitMs),
    clientSubmitToResponse: formatMs(derived.submitToResponseMs),
    clientStopToNextAudio: formatMs(derived.stopToNextAudioMs),
    clientAudioGap: formatMs(derived.audioGapMs),
    backendTotal: formatMs(backendLatency?.totalMs),
    backendLoadQuestion: formatMs(backendLatency?.steps?.find((step) => step.step === 'load_latest_question')?.durationMs),
    backendSaveTurn: formatMs(backendLatency?.steps?.find((step) => step.step === 'save_realtime_user_turn')?.durationMs),
    backendAdaptiveNextQuestion: formatMs(backendLatency?.steps?.find((step) => step.step === 'adaptive_next_question')?.durationMs),
    backendUpdateSession: formatMs(backendLatency?.steps?.find((step) => step.step === 'update_session_state')?.durationMs),
    backendTts: formatMs(backendLatency?.steps?.find((step) => step.step === 'tts_synthesis')?.durationMs),
  };
};

