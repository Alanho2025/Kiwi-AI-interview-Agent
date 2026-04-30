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

const removeEmptyLatencyFields = (summary) => Object.fromEntries(
  Object.entries(summary).filter(([, value]) => value !== 'n/a' && value !== null && value !== undefined)
);

export const buildVoiceLatencyConsoleSummary = ({ trace = null, backendLatency = null, phase = 'turn' } = {}) => {
  const derived = trace?.derived || {};
  const summary = {
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
    backendAdaptiveIndexingCheckStart: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.indexing_check_start')),
    backendAdaptiveIndexingCheck: formatVoiceLatencyMs(getStepDuration(backendLatency, 'adaptive.indexing_check')),
    backendAdaptiveIndexingCheckEnd: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.indexing_check_end')),
    backendAdaptiveRetrievalStart: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.retrieval_start')),
    backendAdaptiveRetrieval: formatVoiceLatencyMs(getStepDuration(backendLatency, 'adaptive.retrieval')),
    backendAdaptiveRetrievalEnd: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.retrieval_end')),
    backendAdaptiveEnvironmentBuildStart: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.environment_build_start')),
    backendAdaptiveEnvironmentBuild: formatVoiceLatencyMs(getStepDuration(backendLatency, 'adaptive.environment_build')),
    backendAdaptiveEnvironmentBuildEnd: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.environment_build_end')),
    backendAdaptiveTurnEvaluationStart: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.turn_evaluation_start')),
    backendAdaptiveTurnEvaluation: formatVoiceLatencyMs(getStepDuration(backendLatency, 'adaptive.turn_evaluation')),
    backendAdaptiveTurnEvaluationEnd: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.turn_evaluation_end')),
    backendAdaptiveDecisionContextStart: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.decision_context_start')),
    backendAdaptiveDecisionContext: formatVoiceLatencyMs(getStepDuration(backendLatency, 'adaptive.decision_context')),
    backendAdaptiveDecisionContextEnd: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.decision_context_end')),
    backendAdaptiveActionSelectionStart: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.action_selection_start')),
    backendAdaptiveActionSelection: formatVoiceLatencyMs(getStepDuration(backendLatency, 'adaptive.action_selection')),
    backendAdaptiveActionSelectionEnd: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.action_selection_end')),
    backendAdaptiveActionExecutionStart: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.action_execution_start')),
    backendAdaptiveActionExecution: formatVoiceLatencyMs(getStepDuration(backendLatency, 'adaptive.action_execution')),
    backendAdaptiveActionExecutionEnd: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.action_execution_end')),
    backendAdaptiveLlmFirstToken: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.llm_first_token')),
    backendAdaptiveLlmFirstSentence: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.llm_first_sentence')),
    backendAdaptiveTtsFirstAudio: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'adaptive.tts_first_audio')),
    backendUpdateSession: formatVoiceLatencyMs(getStepDuration(backendLatency, 'update_session_state')),
    backendTts: formatVoiceLatencyMs(getStepDuration(backendLatency, 'tts_synthesis')),
    backendFirstSentenceReady: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'first_sentence_ready')),
    backendFirstAudioSent: formatVoiceLatencyMs(getBackendMarkMs(backendLatency, 'first_audio_sent')),
    backendFirstSentenceTts: formatVoiceLatencyMs(getStepDuration(backendLatency, 'stream_sentence_tts_0')),
  };
  return removeEmptyLatencyFields(summary);
};
