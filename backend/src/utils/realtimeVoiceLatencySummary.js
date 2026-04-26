const formatMs = (value) => {
  if (value == null || Number.isNaN(Number(value))) return 'n/a';
  return `${Math.round(Number(value))} ms`;
};

const getStep = (latency, stepName) => latency?.steps?.find((step) => step.step === stepName || step.name === stepName);
const getStepDuration = (latency, stepName) => getStep(latency, stepName)?.durationMs;
const getMarkMs = (latency, stepName) => getStep(latency, stepName)?.msFromStart;

export const buildRealtimeVoiceLatencySummary = (latency = {}) => ({
  total: formatMs(latency?.totalMs),
  backendRequestReceived: formatMs(getMarkMs(latency, 'backend_request_received')),
  loadLatestQuestion: formatMs(getStepDuration(latency, 'load_latest_question')),
  saveRealtimeUserTurn: formatMs(getStepDuration(latency, 'save_realtime_user_turn')),
  adaptiveNextQuestion: formatMs(getStepDuration(latency, 'adaptive_next_question')),
  firstSentenceReady: formatMs(getMarkMs(latency, 'first_sentence_ready')),
  firstAudioSent: formatMs(getMarkMs(latency, 'first_audio_sent')),
  firstSentenceTts: formatMs(getStepDuration(latency, 'stream_sentence_tts_0')),
  updateSessionState: formatMs(getStepDuration(latency, 'update_session_state')),
  ttsSynthesis: formatMs(getStepDuration(latency, 'tts_synthesis')),
  generateCompletionReport: formatMs(getStepDuration(latency, 'generate_completion_report')),
});
