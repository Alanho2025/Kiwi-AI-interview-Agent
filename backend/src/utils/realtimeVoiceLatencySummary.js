const formatMs = (value) => {
  if (value == null || Number.isNaN(Number(value))) return 'n/a';
  return `${Math.round(Number(value))} ms`;
};

const getStepDuration = (latency, stepName) => latency?.steps?.find((step) => step.step === stepName)?.durationMs;

export const buildRealtimeVoiceLatencySummary = (latency = {}) => ({
  total: formatMs(latency?.totalMs),
  loadLatestQuestion: formatMs(getStepDuration(latency, 'load_latest_question')),
  saveRealtimeUserTurn: formatMs(getStepDuration(latency, 'save_realtime_user_turn')),
  adaptiveNextQuestion: formatMs(getStepDuration(latency, 'adaptive_next_question')),
  updateSessionState: formatMs(getStepDuration(latency, 'update_session_state')),
  ttsSynthesis: formatMs(getStepDuration(latency, 'tts_synthesis')),
  generateCompletionReport: formatMs(getStepDuration(latency, 'generate_completion_report')),
});

