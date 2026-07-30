import { getAgentMemory } from './agentMemoryService.js';
import { buildEvidenceBundle } from './evidenceBundleService.js';
import { buildInterviewEnvironment } from './interviewEnvironmentService.js';
import { getLatestEvaluatorRecord } from './interviewEvaluatorService.js';
import { deriveDynamicSlots, getDynamicSlotState } from './dynamicSlotService.js';
import { deriveAbductiveState } from './abductiveReasoningService.js';
import { buildSectionState, inferInterviewSection } from './sectionPlannerService.js';
import { getSessionReflectionMemory } from './reflectionWriterService.js';
import { getUserCoachingMemory } from './userCoachingMemoryService.js';
import { buildInterviewTurnPolicy } from '../interview/interviewTurnPolicy.js';
import { resolveQuestionAssessmentContract } from '../questions/questionAssessmentContractService.js';
import {
  buildCompactEvidenceBundle,
  buildCompactRetrievalBundle,
  isCompactVoiceContext,
} from './compactInterviewContextService.js';
import { ensureArray, normalizeText, tokenize } from '../../utils/commonHelpers.js';
import { logger } from '../../utils/logger.js';

const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

const FOLLOW_UP_MEMORY_FAST_MODES = new Set(['probe', 'deepen', 'rephrase', 'scaffold']);
const FRESH_OR_SHIFT_MODES = new Set(['advance', 'shift_section', 'switch_topic', 'fresh_question']);

const recordDiagnosticStep = (diagnostics, step, startedAt, extra = {}) => {
  diagnostics.push({
    step,
    durationMs: Math.round(nowMs() - startedAt),
    ...extra,
  });
};

const markSkippedContextStep = (trace, diagnostics, step, reason = 'not_required_before_first_audio') => {
  const startedAt = nowMs();
  recordDiagnosticStep(diagnostics, step, startedAt, { ok: true, skipped: true, reason });
  trace?.mark?.(`adaptive.decision_context.${step}`, { ok: true, skipped: true, reason });
};

const measureContextStep = async (trace, diagnostics, step, fn, extra = {}) => {
  const startedAt = nowMs();
  try {
    const result = await fn();
    recordDiagnosticStep(diagnostics, step, startedAt, { ok: true, ...extra });
    if (trace?.mark) {
      trace.mark(`adaptive.decision_context.${step}`, { ok: true, ...extra });
    }
    return result;
  } catch (error) {
    recordDiagnosticStep(diagnostics, step, startedAt, {
      ok: false,
      error: error?.message || String(error),
      ...extra,
    });
    if (trace?.mark) {
      trace.mark(`adaptive.decision_context.${step}`, {
        ok: false,
        error: error?.message || String(error),
        ...extra,
      });
    }
    throw error;
  }
};

const measureSyncContextStep = (trace, diagnostics, step, fn, extra = {}) => {
  const startedAt = nowMs();
  try {
    const result = fn();
    recordDiagnosticStep(diagnostics, step, startedAt, { ok: true, ...extra });
    if (trace?.mark) {
      trace.mark(`adaptive.decision_context.${step}`, { ok: true, ...extra });
    }
    return result;
  } catch (error) {
    recordDiagnosticStep(diagnostics, step, startedAt, {
      ok: false,
      error: error?.message || String(error),
      ...extra,
    });
    if (trace?.mark) {
      trace.mark(`adaptive.decision_context.${step}`, {
        ok: false,
        error: error?.message || String(error),
        ...extra,
      });
    }
    throw error;
  }
};

const getLastUserAnswer = (transcript = []) => [...ensureArray(transcript)].reverse().find((turn) => turn.role === 'user')?.text || '';

const inferSpecificityLevel = (answerText = '', latestEvaluation = null) => {
  if (latestEvaluation?.specificity) return latestEvaluation.specificity;
  const tokens = tokenize(answerText);
  const hasNumbers = /\d/.test(answerText);
  const hasExampleWords = ['project', 'built', 'used', 'led', 'implemented', 'improved', 'deployed'].some((token) => tokens.includes(token));
  if (tokens.length >= 40 && (hasNumbers || hasExampleWords)) return 'high';
  if (tokens.length >= 20) return 'medium';
  return 'low';
};

const inferCurrentStage = (session = {}) => {
  const questionPool = ensureArray(session?.interviewPlan?.questionPool);
  const transcriptAiTurns = ensureArray(session.transcript).filter((turn) => turn.role === 'ai');
  const currentIndex = Math.max(0, Number(session?.currentQuestionIndex || 1) - 1);
  const fromPlan = questionPool[currentIndex]?.stage || questionPool[currentIndex]?.type;
  return fromPlan || transcriptAiTurns.at(-1)?.metadata?.stage || 'opening';
};

const buildCoverageState = ({ session = {}, evidenceBundle = {} } = {}) => {
  const topicHistory = ensureArray(session.transcript)
    .filter((turn) => turn.role === 'ai')
    .map((turn) => turn.metadata?.topic)
    .filter(Boolean);
  const priorityTopics = ensureArray(evidenceBundle.matchAnalysis?.questionPlanHints?.priorityTopics);
  const missingTopics = priorityTopics.filter((topic) => !topicHistory.includes(topic));
  return {
    coveredTopics: topicHistory,
    missingTopics,
    weakAreas: ensureArray(evidenceBundle.missingEvidence).slice(0, 6),
  };
};

const inferSuggestedFollowUpMode = ({ latestEvaluation = null, latestAnswerUnderstanding = null } = {}) => normalizeText(
  latestEvaluation?.suggestedNextMode
  || latestAnswerUnderstanding?.followUpRecommendation?.mode
  || latestAnswerUnderstanding?.suggestedFollowUp?.mode
);

export const shouldUseFollowUpMemoryFastPath = ({
  taskType,
  session = {},
  latestEvaluation = null,
  latestAnswerUnderstanding = null,
  requestedPolicy = 'auto',
} = {}) => {
  if (requestedPolicy === 'full') return false;
  if (requestedPolicy === 'follow_up_fast') return true;
  if (taskType !== 'interview_next_turn') return false;
  if (!isCompactVoiceContext({ session })) return false;
  if (!latestEvaluation && !latestAnswerUnderstanding) return false;
  if (latestEvaluation?.closeCurrentIntent) return false;

  const suggestedMode = inferSuggestedFollowUpMode({ latestEvaluation, latestAnswerUnderstanding });
  if (FRESH_OR_SHIFT_MODES.has(suggestedMode)) return false;
  if (latestEvaluation?.misunderstandingFlag) return true;
  if (FOLLOW_UP_MEMORY_FAST_MODES.has(suggestedMode)) return true;

  const missingEvidence = ensureArray(
    latestEvaluation?.plannerSignals?.missingEvidence
    || latestAnswerUnderstanding?.missingEvidence
    || latestAnswerUnderstanding?.coreEvidence?.missing
  );
  const followUpValue = normalizeText(latestAnswerUnderstanding?.followUpValue || latestEvaluation?.plannerSignals?.followUpValue);
  return missingEvidence.length > 0 && followUpValue !== 'low';
};

const resolveMemoryState = async ({
  trace,
  diagnostics,
  session,
  latestEvaluation,
  useFollowUpMemoryFastPath,
} = {}) => {
  if (useFollowUpMemoryFastPath) {
    markSkippedContextStep(trace, diagnostics, 'get_agent_memory', 'follow_up_action_can_use_current_turn_context');
    markSkippedContextStep(trace, diagnostics, 'get_dynamic_slot_state', 'derive_lightweight_slots_from_current_turn');
    markSkippedContextStep(trace, diagnostics, 'get_session_reflection_memory', 'background_memory_refresh_for_follow_up');
    markSkippedContextStep(trace, diagnostics, 'get_user_coaching_memory', 'background_memory_refresh_for_follow_up');
    const resolvedLatestEvaluation = await measureContextStep(
      trace,
      diagnostics,
      'get_latest_evaluator_record',
      () => latestEvaluation || getLatestEvaluatorRecord(session.id),
      { providedEvaluation: Boolean(latestEvaluation), memoryPolicy: 'follow_up_fast' }
    );
    return {
      agentMemory: {},
      resolvedLatestEvaluation,
      storedDynamicSlotState: {},
      sessionReflectionMemory: null,
      userCoachingMemory: null,
    };
  }

  const [agentMemory, resolvedLatestEvaluation, storedDynamicSlotState, sessionReflectionMemory, userCoachingMemory] = await Promise.all([
    measureContextStep(trace, diagnostics, 'get_agent_memory', () => getAgentMemory(session.id), { memoryPolicy: 'full' }),
    measureContextStep(trace, diagnostics, 'get_latest_evaluator_record', () => latestEvaluation || getLatestEvaluatorRecord(session.id), {
      providedEvaluation: Boolean(latestEvaluation),
      memoryPolicy: 'full',
    }),
    measureContextStep(trace, diagnostics, 'get_dynamic_slot_state', () => getDynamicSlotState(session.id), { memoryPolicy: 'full' }),
    measureContextStep(trace, diagnostics, 'get_session_reflection_memory', () => getSessionReflectionMemory(session.id), { memoryPolicy: 'full' }),
    measureContextStep(trace, diagnostics, 'get_user_coaching_memory', () => getUserCoachingMemory(session.userId), { memoryPolicy: 'full' }),
  ]);
  return { agentMemory, resolvedLatestEvaluation, storedDynamicSlotState, sessionReflectionMemory, userCoachingMemory };
};

export const buildDecisionContext = async ({
  taskType,
  session = {},
  retrievalBundle = null,
  latestEvaluation = null,
  latestAnswerUnderstanding = null,
  trace = null,
  memoryLoadPolicy = 'auto',
} = {}) => {
  const diagnostics = [];
  const latestAnswer = measureSyncContextStep(trace, diagnostics, 'latest_answer_extract', () => getLastUserAnswer(session.transcript || []));
  const useCompactContext = taskType === 'interview_next_turn' && isCompactVoiceContext({ session });
  const useFollowUpMemoryFastPath = shouldUseFollowUpMemoryFastPath({
    taskType,
    session,
    latestEvaluation,
    latestAnswerUnderstanding,
    requestedPolicy: memoryLoadPolicy,
  });
  trace?.mark?.('adaptive.decision_context.memory_policy', {
    policy: useFollowUpMemoryFastPath ? 'follow_up_fast' : 'full',
    requestedPolicy: memoryLoadPolicy,
    compactContext: useCompactContext,
  });
  const contextRetrievalBundle = measureSyncContextStep(
    trace,
    diagnostics,
    'compact_retrieval_bundle',
    () => (useCompactContext ? buildCompactRetrievalBundle(retrievalBundle) : retrievalBundle),
    { compactContext: useCompactContext }
  );
  const evidenceBundle = measureSyncContextStep(
    trace,
    diagnostics,
    'evidence_bundle_build',
    () => (useCompactContext
      ? buildCompactEvidenceBundle({ session, retrievalBundle: contextRetrievalBundle })
      : buildEvidenceBundle({ session, retrievalBundle: contextRetrievalBundle })),
    { compactContext: useCompactContext }
  );

  const {
    agentMemory,
    resolvedLatestEvaluation,
    storedDynamicSlotState,
    sessionReflectionMemory,
    userCoachingMemory,
  } = await resolveMemoryState({
    trace,
    diagnostics,
    session,
    latestEvaluation,
    useFollowUpMemoryFastPath,
  });

  const resolvedAnswerUnderstanding = latestAnswerUnderstanding || resolvedLatestEvaluation?.fastAnswerUnderstanding || null;
  const environment = measureSyncContextStep(trace, diagnostics, 'environment_build', () => buildInterviewEnvironment({
    session,
    retrievalBundle: contextRetrievalBundle,
    latestEvaluation: resolvedLatestEvaluation,
    latestAnswerUnderstanding: resolvedAnswerUnderstanding,
  }));
  const currentStage = measureSyncContextStep(trace, diagnostics, 'current_stage_infer', () => inferCurrentStage(session));
  const coverageState = measureSyncContextStep(trace, diagnostics, 'coverage_state_build', () => buildCoverageState({ session, evidenceBundle }));
  const candidateSpecificity = measureSyncContextStep(trace, diagnostics, 'specificity_infer', () => inferSpecificityLevel(latestAnswer, resolvedLatestEvaluation), {
    answerLength: latestAnswer.length,
  });
  const dynamicSlotState = measureSyncContextStep(trace, diagnostics, 'dynamic_slots_derive', () => deriveDynamicSlots({
    latestAnswer,
    coverageState,
    existingState: storedDynamicSlotState,
  }));
  const shouldPreferEvaluationTopic = Boolean(
    resolvedLatestEvaluation?.currentTopic
    && resolvedLatestEvaluation?.suggestedNextMode
    && resolvedLatestEvaluation?.suggestedNextMode !== 'shift_section',
  );
  const currentTopic = measureSyncContextStep(trace, diagnostics, 'current_topic_resolve', () => (
    (shouldPreferEvaluationTopic ? resolvedLatestEvaluation?.currentTopic : null)
    || resolvedAnswerUnderstanding?.followUpRecommendation?.topic
    || resolvedAnswerUnderstanding?.suggestedFollowUp?.topic
    || environment.questionContext.latestQuestionTopic
    || resolvedLatestEvaluation?.currentTopic
    || dynamicSlotState.activeSlotTopics?.[0]
    || evidenceBundle.matchAnalysis?.validationTargets?.[0]
    || coverageState.missingTopics[0]
    || evidenceBundle.missingEvidence[0]
    || evidenceBundle.matchAnalysis?.questionPlanHints?.priorityTopics?.[0]
    || 'role_fit'
  ));
  const interviewStructure = measureSyncContextStep(trace, diagnostics, 'interview_turn_policy_build', () => buildInterviewTurnPolicy(session, { currentTopic, evaluatorState: resolvedLatestEvaluation }));
  const abductiveState = measureSyncContextStep(trace, diagnostics, 'abductive_state_derive', () => deriveAbductiveState({
    latestAnswer,
    currentTopic,
    candidateState: { specificityLevel: candidateSpecificity },
    dynamicSlotState,
  }));
  const currentSection = measureSyncContextStep(trace, diagnostics, 'current_section_infer', () => inferInterviewSection({
    currentStage,
    currentTopic,
    coverageState,
    dynamicSlotState,
    interviewStructure,
  }));
  const sectionState = measureSyncContextStep(trace, diagnostics, 'section_state_build', () => buildSectionState({
    currentSection,
    coverageState,
    dynamicSlotState,
    interviewStructure,
  }));
  const assessmentContract = measureSyncContextStep(trace, diagnostics, 'assessment_contract_resolve', () => resolveQuestionAssessmentContract({
    questionId: environment?.questionContext?.latestQuestionId || 'q_latest',
    intent: environment?.questionContext?.latestQuestionIntent || 'technical_depth',
    parentQuestionFamily: environment?.questionContext?.latestQuestionFamily || 'role_specific',
    parentEvidenceMode: environment?.questionContext?.latestEvidenceMode || 'past_example',
    requiredSignals: environment?.questionContext?.requiredSignals || [],
    collectedSignals: resolvedAnswerUnderstanding?.collectedSignals || [],
  }));

  if (!trace?.mark && taskType === 'interview_next_turn') {
    logger.info('Decision context diagnostic breakdown', {
      sessionId: session.id,
      userId: session.userId,
      compactContext: useCompactContext,
      memoryPolicy: useFollowUpMemoryFastPath ? 'follow_up_fast' : 'full',
      steps: diagnostics,
    });
  }

  return {
    taskType,
    sessionId: session.id,
    userId: session.userId,
    currentStage,
    currentObjective: taskType === 'generate_report' ? 'build_grounded_report' : `collect evidence for ${currentTopic}`,
    currentTopic,
    environment,
    assessmentContract,
    evaluatorState: resolvedLatestEvaluation
      ? {
        successStatus: resolvedLatestEvaluation.successStatus,
        evidenceGainScore: resolvedLatestEvaluation.evidenceGainScore,
        misunderstandingFlag: resolvedLatestEvaluation.misunderstandingFlag,
        interactionStatus: resolvedLatestEvaluation.interactionStatus,
        overallInteractionScore: resolvedLatestEvaluation.overallInteractionScore || 0,
        repetitionRisk: resolvedLatestEvaluation.repetitionRisk,
        reflectionNeeded: resolvedLatestEvaluation.reflectionNeeded,
        suggestedNextMode: resolvedLatestEvaluation.suggestedNextMode,
        currentTopic: resolvedLatestEvaluation.currentTopic,
        frictionState: resolvedLatestEvaluation.frictionState || null,
        mentionedEntities: ensureArray(resolvedLatestEvaluation.mentionedEntities),
        answerUnderstandingSummary: resolvedLatestEvaluation.answerUnderstandingSummary || null,
        plannerSignals: resolvedLatestEvaluation.plannerSignals || null,
        skillDenial: resolvedLatestEvaluation.skillDenial || resolvedLatestEvaluation.plannerSignals?.skillDenial || null,
        fastAnswerUnderstanding: resolvedAnswerUnderstanding,
        gapClosure: resolvedLatestEvaluation.gapClosure || null,
        closeCurrentIntent: Boolean(resolvedLatestEvaluation.closeCurrentIntent),
      }
      : null,
    candidateState: {
      answerStyle: latestAnswer ? (latestAnswer.split(/\s+/).length < 18 ? 'brief' : 'expanded') : 'none',
      confidenceSignal: latestAnswer ? 'medium' : 'unknown',
      specificityLevel: candidateSpecificity,
      evidenceQuality: candidateSpecificity === 'high' ? 'strong' : candidateSpecificity === 'medium' ? 'partial' : 'weak',
    },
    coverageState,
    dynamicSlotState,
    abductiveState,
    sectionState,
    interviewStructure,
    sessionReflectionMemory,
    userCoachingMemory,
    matchState: {
      matchedStrengths: ensureArray(evidenceBundle.matchAnalysis?.matchedStrengths),
      missingRequiredSkills: ensureArray(evidenceBundle.matchAnalysis?.missingRequiredSkills),
      missingPreferredSkills: ensureArray(evidenceBundle.matchAnalysis?.missingPreferredSkills),
      riskyClaims: ensureArray(evidenceBundle.matchAnalysis?.riskyClaims),
      validationTargets: ensureArray(evidenceBundle.matchAnalysis?.validationTargets),
    },
    retrievalState: {
      latestQuery: contextRetrievalBundle?.query || '',
      latestSources: ensureArray(contextRetrievalBundle?.items).map((item) => item.sourceType),
      sourceQuality: contextRetrievalBundle?.sourceQuality || (contextRetrievalBundle?.items?.length ? 'available' : 'limited'),
      retrievalObjective: contextRetrievalBundle?.objective || null,
      correctiveRetryUsed: Boolean(contextRetrievalBundle?.correctiveRetryUsed),
      compactContext: useCompactContext,
    },
    agentMemory,
    userInterviewMemory: agentMemory.userInterviewProjection || null,
    constraints: {
      maxQuestionLength: 'short',
      keepTalkTimeHigh: true,
      avoidRedundantTopics: true,
    },
    plannerSignals: resolvedLatestEvaluation?.plannerSignals || null,
    evidenceBundle,
    latestAnswerUnderstanding: resolvedAnswerUnderstanding,
    latestAnswer,
    memoryLoadPolicy: {
      requested: memoryLoadPolicy,
      effective: useFollowUpMemoryFastPath ? 'follow_up_fast' : 'full',
      heavyMemorySkippedBeforeFirstAudio: useFollowUpMemoryFastPath,
    },
    diagnostics: {
      decisionContextSteps: diagnostics,
    },
  };
};
