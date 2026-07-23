import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { ensureArray } from '../../utils/commonHelpers.js';

const getStepDuration = (latency = {}, stepName = '') => ensureArray(latency.steps).find((step) => step.step === stepName)?.durationMs ?? null;
const getMarkMs = (latency = {}, stepName = '') => ensureArray(latency.steps).find((step) => step.step === stepName)?.msFromStart ?? null;

export const buildLatencyBreakdown = (latency = {}) => ({
  sttMs: getStepDuration(latency, 'save_realtime_user_turn'),
  retrievalMs: getStepDuration(latency, 'adaptive.retrieval'),
  planningMs: getStepDuration(latency, 'adaptive.action_selection'),
  modelSelectionMs: getStepDuration(latency, 'adaptive.model_action_selection'),
  llmFirstTokenMs: getMarkMs(latency, 'adaptive.llm_first_token') || getMarkMs(latency, 'adaptive.llm_first_sentence'),
  ttsFirstAudioMs: getMarkMs(latency, 'adaptive.tts_first_audio'),
  totalTurnMs: latency.totalMs || null,
});

export const recordAgentTraceEvent = async ({ sessionId, workflowRunId = null, eventType, mode = 'text', payload = {} } = {}) => {
  if (!sessionId || !eventType) return null;
  const event = {
    eventId: `${eventType}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    eventType,
    createdAt: new Date().toISOString(),
    sessionId,
    workflowRunId,
    mode,
    ...payload,
  };
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    { $push: { agentTraceEvents: event } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return event;
};

export const buildCompactTraceSummary = ({ session = {}, trajectoryRecords = [], agentTraceEvents = [], report = null, executionCost = null } = {}) => {
  const latestTrajectory = ensureArray(trajectoryRecords).at(-1) || {};
  const latestTrace = ensureArray(agentTraceEvents).at(-1) || {};
  const latestStar = latestTrajectory.starScores || latestTrajectory.plannerSignals?.starScores || {};
  const costSummary = executionCost?.summary || executionCost?.commercialStressTest || {};
  return {
    sessionId: session.id || latestTrajectory.sessionId || latestTrace.sessionId || '',
    mode: session.mode || latestTrace.mode || 'text',
    interviewType: session.settings?.focusArea || session.questionType || 'combined',
    ragUsed: ensureArray(latestTrajectory.retrievalSources || latestTrace.retrievalSources).length > 0,
    retrievalSources: latestTrajectory.retrievalSources || latestTrace.retrievalSources || [],
    retrievalConfidence: latestTrace.retrievalConfidence ?? null,
    starScores: latestStar,
    coachingConfidence: report?.candidateFeedback?.turnBreakdowns?.[0]?.confidenceLevel || report?.candidateFeedback?.coachingAdvice?.[0]?.confidenceLevel || 'medium',
    latencyBreakdown: latestTrace.latencyBreakdown || {},
    cost: {
      llm: costSummary.llmCost || costSummary.totalLlmCost || 0,
      embedding: costSummary.embeddingCost || 0,
      speech: costSummary.speechCost || 0,
      total: costSummary.totalEstimatedCost || costSummary.totalExecutionCost || 0,
    },
  };
};
