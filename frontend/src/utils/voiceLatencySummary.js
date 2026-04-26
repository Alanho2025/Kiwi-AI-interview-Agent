export const formatVoiceLatencyMs = (value) => {
  if (value == null || Number.isNaN(Number(value))) return 'n/a';
  return `${Math.round(Number(value))} ms`;
};

const getStep = (backendLatency, stepName) => backendLatency?.steps?.find(
  (step) => step?.step === stepName || step?.name === stepName
);

const getStepDuration = (backendLatency, stepName) => getStep(backendLatency, stepName)?.durationMs;

const getBackendMarkMs = (backendLatency, markerName) => {
  if (!backendLatency) return null;
  const directMarker = backendLatency?.markers?.[markerName];
  if (Number.isFinite(Number(directMarker?.msFromStart))) return Number(directMarker.msFromStart);
  if (Number.isFinite(Number(directMarker))) return Number(directMarker);

  const step = getStep(backendLatency, markerName);
  if (Number.isFinite(Number(step?.msFromStart))) return Number(step.msFromStart);
  return null;
};

const getLatestEvent = (trace, name) => {
  const events = Array.isArray(trace?.events) ? trace.events : [];
  return [...events].reverse().find((event) => event?.name === name) || null;
};

const getTraceMeta = (trace = null) => {
  const vadConfig = getLatestEvent(trace, 'vad_config') || {};
  const finalTranscript = getLatestEvent(trace, 'final_transcript_received') || {};
  return {
    traceId: trace?.traceId || 'n/a',
    vadPauseCandidateMs: formatVoiceLatencyMs(vadConfig.pauseCandidateMs),
    vadPauseConfirmMs: formatVoiceLatencyMs(vadConfig.pauseConfirmMs),
    vadSilenceToStopMs: formatVoiceLatencyMs(vadConfig.silenceToStopMs),
    clientTranscriptSource: finalTranscript.source || 'n/a',
    clientUsedPartialFallback: String(Boolean(finalTranscript.usedPartialFallback || finalTranscript.fallback)),
  };
};

export const buildVoiceLatencyConsoleSummary = ({ trace = null, backendLatency = null, phase = 'turn' } = {}) => {
  const derived = trace?.derived || {};
  return {
    phase,
    ...getTraceMeta(trace),
    clientVadToPlayback: formatVoiceLatencyMs(derived.vadToPlaybackMs ?? derived.stopToNextAudioMs),
    clientSubmitToFirstAudioChunk: formatVoiceLatencyMs(derived.submitToFirstAudioChunkMs),
    clientSubmitToPlaybackStart: formatVoiceLatencyMs(derived.submitToPlaybackStartMs),
    clientSttFinalisation: formatVoiceLatencyMs(derived.sttFinalisationMs),
    clientFirstAudioChunkToPlay: formatVoiceLatencyMs(derived.firstAudioChunkToPlayMs),
    clientPauseCandidateToConfirmed: formatVoiceLatencyMs(derived.pauseCandidateToConfirmedMs),
    clientPlaybackToMicReady: formatVoiceLatencyMs(derived.playbackToMicReadyMs ?? derived.audioGapMs),
    clientAudioPlayback: formatVoiceLatencyMs(derived.audioPlaybackMs),
    backendTotal: formatVoiceLatencyMs(backendLatency?.totalMs),
    backendLoadQuestion: formatVoiceLatencyMs(getStepDuration(backendLatency, 'load_latest_question')),
    backendSaveTurn: formatVoiceLatencyMs(getStepDuration(backendLatency, 'save_realtime_user_turn')),
    backendAdaptiveNextQuestion: formatVoiceLatencyMs(getStepDuration(backendLatency, 'adaptive_next_question')),
    backendUpdateSession: formatVoiceLatencyMs(getStepDuration(backendLatency, 'update_session_state')),
    backendTts: formatVoiceLatencyMs(getStepDuration(backendLatency, 'tts_synthesis')),
    backendFirstSentenceReady: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'first_sentence_ready')),
    backendFirstAudioSent: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'first_audio_sent')),
    backendFirstSentenceTts: formatVoiceLatencyMs(getStepDuration(backendLatency, 'stream_sentence_tts_0')),
  };
};
