const formatMs = (value) => {
  if (value == null || Number.isNaN(Number(value))) return 'n/a';
  return `${Math.round(Number(value))} ms`;
};

const getStep = (latency, stepName) => latency?.steps?.find((step) => step.step === stepName || step.name === stepName);
const getStepDuration = (latency, stepName) => getStep(latency, stepName)?.durationMs;
const getMarkMs = (latency, stepName) => getStep(latency, stepName)?.msFromStart;

const omitNaValues = (summary) => Object.fromEntries(
  Object.entries(summary).filter(([, value]) => value !== 'n/a')
);

export const buildRealtimeVoiceLatencySummary = (latency = {}) => {
  const baseSummary = {
    total: formatMs(latency?.totalMs),
    loadLatestQuestion: formatMs(getStepDuration(latency, 'load_latest_question')),
    saveRealtimeUserTurn: formatMs(getStepDuration(latency, 'save_realtime_user_turn')),
    adaptiveNextQuestion: formatMs(getStepDuration(latency, 'adaptive_next_question')),
    updateSessionState: formatMs(getStepDuration(latency, 'update_session_state')),
    ttsSynthesis: formatMs(getStepDuration(latency, 'tts_synthesis')),
    generateCompletionReport: formatMs(getStepDuration(latency, 'generate_completion_report')),
  };

  const adaptiveSummary = omitNaValues({
    backendRequestReceived: formatMs(getMarkMs(latency, 'backend_request_received')),
    adaptiveIndexingCheckStart: formatMs(getMarkMs(latency, 'adaptive.indexing_check_start')),
    adaptiveIndexingCheck: formatMs(getStepDuration(latency, 'adaptive.indexing_check')),
    adaptiveIndexingCheckEnd: formatMs(getMarkMs(latency, 'adaptive.indexing_check_end')),
    adaptiveRetrievalStart: formatMs(getMarkMs(latency, 'adaptive.retrieval_start')),
    adaptiveRetrieval: formatMs(getStepDuration(latency, 'adaptive.retrieval')),
    adaptiveRetrievalEnd: formatMs(getMarkMs(latency, 'adaptive.retrieval_end')),
    adaptiveEnvironmentBuildStart: formatMs(getMarkMs(latency, 'adaptive.environment_build_start')),
    adaptiveEnvironmentBuild: formatMs(getStepDuration(latency, 'adaptive.environment_build')),
    adaptiveEnvironmentBuildEnd: formatMs(getMarkMs(latency, 'adaptive.environment_build_end')),
    adaptiveFastAnswerUnderstandingStart: formatMs(getMarkMs(latency, 'adaptive.fast_answer_understanding_start')),
    adaptiveFastAnswerUnderstanding: formatMs(getStepDuration(latency, 'adaptive.fast_answer_understanding')),
    adaptiveFastAnswerUnderstandingEnd: formatMs(getMarkMs(latency, 'adaptive.fast_answer_understanding_end')),
    adaptiveTurnEvaluationStart: formatMs(getMarkMs(latency, 'adaptive.turn_evaluation_start')),
    adaptiveTurnEvaluation: formatMs(getStepDuration(latency, 'adaptive.turn_evaluation')),
    adaptiveTurnEvaluationEnd: formatMs(getMarkMs(latency, 'adaptive.turn_evaluation_end')),
    adaptiveDecisionContextStart: formatMs(getMarkMs(latency, 'adaptive.decision_context_start')),
    adaptiveDecisionContext: formatMs(getStepDuration(latency, 'adaptive.decision_context')),
    adaptiveDecisionContextEnd: formatMs(getMarkMs(latency, 'adaptive.decision_context_end')),
    adaptiveActionSelectionStart: formatMs(getMarkMs(latency, 'adaptive.action_selection_start')),
    adaptiveActionSelection: formatMs(getStepDuration(latency, 'adaptive.action_selection')),
    adaptiveActionSelectionEnd: formatMs(getMarkMs(latency, 'adaptive.action_selection_end')),
    adaptiveActionExecutionStart: formatMs(getMarkMs(latency, 'adaptive.action_execution_start')),
    adaptiveActionExecution: formatMs(getStepDuration(latency, 'adaptive.action_execution')),
    adaptiveActionExecutionEnd: formatMs(getMarkMs(latency, 'adaptive.action_execution_end')),
    adaptiveLlmFirstToken: formatMs(getMarkMs(latency, 'adaptive.llm_first_token')),
    adaptiveLlmFirstSentence: formatMs(getMarkMs(latency, 'adaptive.llm_first_sentence')),
    adaptiveTtsFirstAudio: formatMs(getMarkMs(latency, 'adaptive.tts_first_audio')),
    firstSentenceReady: formatMs(getMarkMs(latency, 'first_sentence_ready')),
    firstAudioSent: formatMs(getMarkMs(latency, 'first_audio_sent')),
    firstSentenceTts: formatMs(getStepDuration(latency, 'stream_sentence_tts_0')),
  });

  return {
    ...baseSummary,
    ...adaptiveSummary,
  };
};
