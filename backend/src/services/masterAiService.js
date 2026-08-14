/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: masterAiService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { AGENT_DECISION_TYPES } from '../constants/agentDecisionTypes.js';
import { AGENT_TOOL_NAMES, getToolNameForAction } from '../constants/agentToolNames.js';
import { agentRegistry } from './agentRegistryService.js';
import {
  getSessionById,
  appendTranscriptTurn,
  createInterviewQuestion,
  getLatestQuestionForSession,
} from './sessionService.js';
import { getNextQuestionOrder, hasReachedQuestionLimit, hasReachedTimeLimit } from './interviewStateService.js';
import { ensureSessionArtifactsIndexed } from './ragIndexService.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { SessionReport } from '../db/models/sessionReportModel.js';
import { buildDecisionContext } from './aiControl/decisionContextBuilder.js';
import { buildInterviewEnvironment } from './aiControl/interviewEnvironmentService.js';
import { createDecisionRecord } from './aiControl/decisionRecordService.js';
import { selectNextAction } from './aiControl/actionPlanner.js';
import { selectActionWithModel } from './aiControl/modelActionSelectorService.js';
import { resolveVoiceAgentDecisionOnce } from './aiControl/voiceAgentDecisionService.js';
import { updateAgentMemory } from './aiControl/agentMemoryService.js';
import { executeInterviewAction } from './aiControl/interviewActionExecutor.js';
import { persistEvaluatorRecord } from './aiControl/interviewEvaluatorService.js';
import { buildTrajectoryStep, persistTrajectoryStep } from './aiControl/trajectoryService.js';
import { executeReportAction } from './aiControl/reportActionExecutor.js';
import { buildEvidenceBundle } from './aiControl/evidenceBundleService.js';
import { logger } from '../utils/logger.js';
import voiceOptimizationConfig from '../config/voiceOptimizationConfig.js';
import { resolveFastAnswerUnderstanding } from './aiControl/fastAnswerUnderstandingService.js';
import { recordAgentTraceEvent } from './aiControl/agentTraceService.js';
import { persistDynamicSlotState } from './aiControl/dynamicSlotService.js';
import { buildReflectionRecord, shouldWriteReflection, persistReflectionRecord } from './aiControl/reflectionWriterService.js';
import { persistUserCoachingMemory } from './aiControl/userCoachingMemoryService.js';
import { rebuildBoundedMemory } from './aiControl/experienceMemoryService.js';
import { enqueueBackgroundJob } from '../jobs/backgroundJobQueue.js';
import { recordLocalUsage } from './aiUsageTrackingService.js';
import {
  getPreparedQuestionPool,
  markQuestionPoolItemAsked,
  reconcileQuestionPoolFromTranscript,
} from './questions/questionPoolComposerService.js';
import {
  recordAcceptedAnswerCoverage,
  recordSessionQuestionSelection,
} from './questions/sessionQuestionSetService.js';
import { buildCatalogCoverageOutcome } from './questions/questionCatalogSelectionService.js';
import { cleanupQuestionArtifactsAfterReport } from './questions/questionArtifactCleanupService.js';
import { indexReportSessionArtifactsSafely } from './reportIndexingGuardService.js';
import { buildAssessmentKey, buildQuestionFingerprint } from './questions/questionDeduplicationService.js';
import { resolveQuestionAssessmentIntent } from './questions/questionArtifactHelpers.js';
import { buildRetentionExpiry } from './retention/retentionPolicy.js';
import {
  getHarnessExecutionMode,
  isHarnessShadowEnabled,
  isUserInterviewMemoryPlanningEnabled,
} from '../config/harnessConfig.js';
import {
  runInterviewNextTurnWithShadowHarness,
  scheduleHarnessRunPersistence,
} from './harness/interviewNextTurnShadowHarness.js';
import { refreshUserInterviewMemoryProjection } from './aiControl/userInterviewMemoryService.js';
import { runReportTaskWithHarness } from './harness/reportWorkflowHarness.js';
import {
  isActionableQuestionScopeObservation,
  resolveQuestionScopeObservation,
} from './voice/questionScopeClarificationService.js';
import {
  executeQuestionScopeControllerTurn,
  persistExplicitAssumptionFraming,
} from './voice/questionScopeControllerService.js';

const scheduleCatalogCoverageTrace = ({ sessionId, coverageOutcome }) => {
  enqueueBackgroundJob('record-catalog-coverage-completion', () => recordAgentTraceEvent({
    sessionId,
    eventType: 'catalog_coverage_completed',
    mode: 'voice',
    payload: {
      status: coverageOutcome.status,
      completedBecause: coverageOutcome.completedBecause,
      reservations: (coverageOutcome.reservations || []).map((reservation) => ({
        coverageSlot: reservation.coverageSlot,
        minAsked: reservation.minAsked,
        askedCount: reservation.askedCount,
        status: reservation.status,
        degradedReason: reservation.degradedReason,
      })),
    },
  }), { sessionId });
};

const buildCandidateSafeCatalogCoverage = (coverageOutcome = {}) => {
  const reservations = coverageOutcome.reservations || [];
  return {
    status: coverageOutcome.status || 'not_applicable',
    completedBecause: coverageOutcome.completedBecause || null,
    requiredCoverageCount: reservations.length,
    coveredCoverageCount: reservations.filter((reservation) => reservation.status === 'covered').length,
    degradedCoverageCount: reservations.filter((reservation) => reservation.status === 'degraded').length,
  };
};

export const attachCatalogCoverageToCompletion = async ({
  session = {},
  result = {},
  loadPool = getPreparedQuestionPool,
  recordCoverageTrace = null,
} = {}) => {
  if (session.mode !== 'voice' || !result.isComplete) return result;
  try {
    const poolItems = await loadPool({ sessionId: session.id, status: null });
    const coverageOutcome = buildCatalogCoverageOutcome({
      poolItems,
      session,
      completedBecause: result.completedBecause || null,
    });
    if (recordCoverageTrace) recordCoverageTrace(coverageOutcome);
    else scheduleCatalogCoverageTrace({ sessionId: session.id, coverageOutcome });
    return {
      ...result,
      catalogCoverage: buildCandidateSafeCatalogCoverage(coverageOutcome),
    };
  } catch {
    return {
      ...result,
      catalogCoverage: {
        status: 'coverage_observation_degraded',
        completedBecause: result.completedBecause || null,
        degradedReason: 'catalog_coverage_read_failed',
        requiredCoverageCount: 0,
        coveredCoverageCount: 0,
        degradedCoverageCount: 0,
      },
    };
  }
};

const persistControllerSnapshot = async ({ sessionId, decisionContext = null, evidenceBundle = null } = {}) => {
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        evidenceBundleSnapshot: evidenceBundle || {},
        controllerState: decisionContext
          ? {
              currentStage: decisionContext.currentStage,
              currentObjective: decisionContext.currentObjective,
              currentTopic: decisionContext.currentTopic,
              candidateState: decisionContext.candidateState,
              coverageState: decisionContext.coverageState,
              matchState: decisionContext.matchState,
              retrievalState: decisionContext.retrievalState,
              evaluatorState: decisionContext.evaluatorState,
              plannerSignals: decisionContext.plannerSignals,
              dynamicSlotState: decisionContext.dynamicSlotState,
              abductiveState: decisionContext.abductiveState,
              sectionState: decisionContext.sectionState,
              sessionReflectionMemory: decisionContext.sessionReflectionMemory,
              userCoachingMemory: decisionContext.userCoachingMemory,
            }
          : {},
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const persistReportArtifact = async ({ sessionId, userId, report, qaResult, repairHistory = [] }) => {
  const latestStatus = qaResult?.passed 
    ? (repairHistory.length > 0 ? 'ready_after_repair' : 'ready')
    : (repairHistory.length > 0 ? 'repair_failed' : 'needs_review');

  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $push: {
        reportArtifacts: {
          createdAt: new Date(),
          report,
          qaResult,
          repairHistory,
          status: latestStatus,
        },
      },
    },
    { upsert: true }
  );

  return SessionReport.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      userId,
      report,
      qaResult,
      latestStatus,
      repairHistory,
      qaAttemptCount: repairHistory.length + 1,
      retentionUntil: buildRetentionExpiry(),
      deletedAt: null,
      containsSensitiveData: true,
      accessScope: 'private',
      schemaVersion: 'v7',
      $push: {
        reportVersions: {
          version: Date.now(),
          report,
          qaResult,
          status: latestStatus,
          createdAt: new Date(),
        }
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const getSessionMatchAnalysisId = (session = {}) =>
  session?.interviewPlan?.strategy?.matchAnalysisId
  || session?.interviewPlan?.questionPlanSnapshot?.matchAnalysisId
  || session?.analysisResult?.retrievalSnapshots?.[0]?.matchAnalysisId
  || null;

const cleanupQuestionArtifactsForCompletedReport = async ({ session }) => {
  try {
    const result = await cleanupQuestionArtifactsAfterReport({
      userId: session.userId,
      sessionId: session.id,
      cvFileId: session.cvFileId || null,
      matchAnalysisId: getSessionMatchAnalysisId(session),
    });
    logger.info('Question preparation artifacts cleaned after report generation', {
      sessionId: session.id,
      userId: session.userId,
      ...result,
    });
  } catch (error) {
    logger.warn('Question preparation artifact cleanup failed after report generation', {
      sessionId: session.id,
      userId: session.userId,
      error: error.message,
    });
  }
};

const measureAdaptiveStep = async (trace, stepName, fn) => {
  if (!trace?.measure) return fn();
  trace.mark?.(`${stepName}_start`);
  try {
    return await trace.measure(stepName, fn);
  } finally {
    trace.mark?.(`${stepName}_end`);
  }
};

const buildInterviewRetrievalInput = ({ session, payload = {}, objective = 'bootstrap_interview_context' } = {}) => ({
  query: buildDefaultRetrievalQuery({ session, payload, mode: 'interview' }),
  sessionId: session.id,
  sourceTypes: ['question_bank', 'behavioural_bank', 'interview_plan', 'prepared_question_pool', 'jd_rubric', 'cv_profile', 'transcript'],
  topK: objective === 'warm_adaptive_session' ? 3 : 5,
  objective,
  targetTopic: session.targetRole,
});

const buildDefaultRetrievalQuery = ({ session = {}, payload = {}, mode = 'interview' } = {}) => {
  const roleCanonical = session.analysisResult?.matchingDetails?.questionPlanHints?.roleCanonical || '';
  const interviewFocus = (session.analysisResult?.interviewFocus || []).join(' ');
  const answerSlice = (payload.answer || '').slice(0, 300);
  if (mode === 'report') {
    return `${session.targetRole || ''} ${roleCanonical} report summary evidence transcript support`.trim();
  }
  return `${session.targetRole || ''} ${roleCanonical} ${interviewFocus} ${answerSlice}`.trim();
};

export const shouldUseSingleBlockingLlmVoicePath = ({ inputMode = '' } = {}) => ['duplex_voice', 'realtime_voice'].includes(inputMode);

export const shouldMarkPreparedRootQuestionAsked = ({ interviewerOutput = {} } = {}) => {
  const preparedQuestionId = interviewerOutput?.questionDecision?.preparedQuestionId || interviewerOutput?.preparedQuestionId || null;
  const turnKind = interviewerOutput?.turnKind || interviewerOutput?.questionDecision?.turnKind || null;
  return Boolean(preparedQuestionId && turnKind === 'root_question');
};

const resolveQuestionTurnType = (interviewerOutput = {}) => {
  const turnKind = interviewerOutput.turnKind || interviewerOutput.questionDecision?.turnKind || '';
  const scenario = interviewerOutput.scenario || interviewerOutput.questionDecision?.scenario || '';
  const questionType = interviewerOutput.questionType || '';
  if (questionType === 'transcript_confirmation' || scenario === 'clarify_audio_or_transcript') return 'transcript_confirmation';
  if (questionType === 'question_scope_clarification' || scenario === 'question_scope_clarification') return 'question_scope_clarification';
  if (questionType === 'clarification') return 'clarification';
  if (turnKind === 'repair' || ['rephrase', 'scaffold'].includes(scenario)) return 'repair_prompt';
  if (turnKind === 'system' || questionType === 'system') return 'system';
  return 'interview_question';
};

export const buildQuestionTranscriptMetadata = (interviewerOutput = {}) => {
  const turnType = resolveQuestionTurnType(interviewerOutput);
  const countsAsQuestion = turnType === 'interview_question';
  const catalogDecision = interviewerOutput.questionDecision || {};
  const selectionPolicy = interviewerOutput.selectionPolicy || catalogDecision.selectionPolicy || null;
  const questionFields = {
    ...interviewerOutput,
    turnKind: interviewerOutput.turnKind || interviewerOutput.questionDecision?.turnKind || 'root_question',
    questionFamily: interviewerOutput.questionFamily || null,
    text: interviewerOutput.displayText || interviewerOutput.nextQuestion || interviewerOutput.text || '',
  };

  const currentIntentResolution = resolveQuestionAssessmentIntent({
    questionFamily: questionFields.questionFamily,
    category: questionFields.requirementCategory,
    questionType: questionFields.questionType,
    questionIntent: questionFields.questionType,
    evidenceMode: interviewerOutput.evidenceMode,
    text: questionFields.text,
  });

  let parentIntentResolution = { intent: null, source: null };
  if (interviewerOutput.parentQuestionFamily || interviewerOutput.parentEvidenceMode) {
    parentIntentResolution = resolveQuestionAssessmentIntent({
      questionFamily: interviewerOutput.parentQuestionFamily,
      evidenceMode: interviewerOutput.parentEvidenceMode,
    });
  }

  return {
    assessmentIntent: currentIntentResolution.intent,
    assessmentIntentSource: currentIntentResolution.source,
    parentAssessmentIntent: parentIntentResolution.intent,
    parentAssessmentIntentSource: parentIntentResolution.source,
    questionFamily: questionFields.questionFamily,
    evidenceMode: interviewerOutput.evidenceMode || null,
    targetedDimensions: interviewerOutput.targetedDimensions || [],
    parentQuestionFamily: interviewerOutput.parentQuestionFamily || null,
    parentEvidenceMode: interviewerOutput.parentEvidenceMode || null,
    roleDomain: interviewerOutput.roleDomain || 'general',
    requirementCategory: interviewerOutput.requirementCategory || null,
    capabilityGroup: interviewerOutput.capabilityGroup || null,
    catalogQuestionId: interviewerOutput.catalogQuestionId || catalogDecision.catalogQuestionId || null,
    catalogVersion: interviewerOutput.catalogVersion || catalogDecision.catalogVersion || null,
    catalogLifecycle: interviewerOutput.catalogLifecycle || null,
    targetLevel: interviewerOutput.targetLevel || null,
    testedSignals: Array.isArray(interviewerOutput.testedSignals) ? interviewerOutput.testedSignals : [],
    eligibilityReason: Array.isArray(interviewerOutput.eligibilityReason)
      ? interviewerOutput.eligibilityReason
      : (Array.isArray(catalogDecision.eligibilityReason) ? catalogDecision.eligibilityReason : []),
    selectionPolicy: selectionPolicy
      ? {
          minAsked: Number(selectionPolicy.minAsked) || 0,
          maxAsked: Number(selectionPolicy.maxAsked) || 0,
          reservationPriority: Number(selectionPolicy.reservationPriority) || 0,
          coverageSlot: selectionPolicy.coverageSlot || null,
        }
      : null,
    coverageSlot: interviewerOutput.coverageSlot || catalogDecision.coverageSlot || null,
    ambiguityMode: interviewerOutput.ambiguityMode || null,
    clarificationContextVersion: interviewerOutput.clarificationContextVersion || null,
    clarificationContext: interviewerOutput.clarificationContext?.responseText
      ? { responseText: interviewerOutput.clarificationContext.responseText }
      : null,
    reportDimensions: Array.isArray(interviewerOutput.reportDimensions) ? interviewerOutput.reportDimensions : [],
    turnType,
    countsAsQuestion,
    parentQuestionId: interviewerOutput.parentQuestionId || interviewerOutput.questionDecision?.parentQuestionId || null,
    assessmentKey: buildAssessmentKey(questionFields),
    questionFingerprint: buildQuestionFingerprint(questionFields.text),
    dedupeTrace: interviewerOutput.questionDecision?.deduplication || null,
  };
};

export const shouldPersistInterviewQuestion = ({ interviewerOutput = {} } = {}) => (
  buildQuestionTranscriptMetadata(interviewerOutput).countsAsQuestion
);

export const buildPreparedQuestionStateDiagnostic = ({ markResult, sessionId, preparedQuestionId } = {}) => (
  markResult
    ? null
    : {
        level: 'warning',
        code: 'prepared_question_asked_state_update_missed',
        sessionId,
        preparedQuestionId,
    }
);

export const persistPreparedRootQuestionSelection = async ({
  session = {},
  preparedQuestionId = null,
  nextQuestionOrder = null,
  questionDecision = {},
  markPreparedQuestionAsked = markQuestionPoolItemAsked,
  recordQuestionSelection = recordSessionQuestionSelection,
  log = logger,
} = {}) => {
  let markResult;
  try {
    markResult = await markPreparedQuestionAsked({
      sessionId: session.id,
      questionId: preparedQuestionId,
      askedTurnIndex: nextQuestionOrder,
      rankTrace: questionDecision?.rankTrace || {},
    });
  } catch (error) {
    log.warn('Prepared question pool asked-state update failed', {
      sessionId: session.id,
      preparedQuestionId,
      error: error.message,
    });
    return { marked: false, selectionRecorded: false };
  }

  const diagnostic = buildPreparedQuestionStateDiagnostic({
    markResult,
    sessionId: session.id,
    preparedQuestionId,
  });
  if (diagnostic) {
    log.warn('Prepared question pool asked-state update missed its row', diagnostic);
    return { marked: false, selectionRecorded: false };
  }

  try {
    await recordQuestionSelection({
      sessionId: session.id,
      userId: session.userId,
      turn: nextQuestionOrder,
      questionDecision,
    });
    return { marked: true, selectionRecorded: true };
  } catch (error) {
    log.warn('Session question-set selection trace update failed', {
      sessionId: session.id,
      userId: session.userId,
      preparedQuestionId,
      error: error.message,
    });
    return { marked: true, selectionRecorded: false };
  }
};

const runInterviewController = async ({
  session,
  payload = {},
  onSentence = null,
  trace = null,
  workflowRunId = null,
  harnessObserver = () => {},
  capabilityRegistry = agentRegistry,
}) => {
  const isVoiceMode = ['duplex_voice', 'realtime_voice'].includes(payload.inputMode);
  const latestQuestion = isVoiceMode
    ? await getLatestQuestionForSession(session.id)
    : null;
  const questionScopeObservation = isVoiceMode
    ? resolveQuestionScopeObservation({
        session,
        candidateText: payload.answer || '',
        activeQuestion: latestQuestion,
      })
    : { kind: 'none', reason: 'not_voice_mode' };

  if (questionScopeObservation.kind === 'explicit_assumption') {
    await persistExplicitAssumptionFraming({
      sessionId: session.id,
      observation: questionScopeObservation,
    });
  }

  if (hasReachedTimeLimit(session)) {
    return attachCatalogCoverageToCompletion({ session, result: {
      isComplete: true,
      completedBecause: 'time_limit_reached',
      nextQuestion: null,
      nextQuestionOrder: session.currentQuestionIndex,
      rationale: 'Interview completed after the planned time limit.',
      retrievalSnapshot: null,
    } });
  }

  if (isActionableQuestionScopeObservation(questionScopeObservation)) {
    return executeQuestionScopeControllerTurn({
      session,
      observation: questionScopeObservation,
      onSentence,
      workflowRunId,
      harnessObserver,
    });
  }

  if (hasReachedQuestionLimit(session)) {
    return attachCatalogCoverageToCompletion({ session, result: {
      isComplete: true,
      completedBecause: 'question_limit_reached',
      nextQuestion: null,
      nextQuestionOrder: session.currentQuestionIndex,
      rationale: 'Interview completed after the planned question limit.',
      retrievalSnapshot: null,
    } });
  }

  enqueueBackgroundJob('trace-answer-evaluated-start', () => recordAgentTraceEvent({
    sessionId: session.id,
    workflowRunId,
    eventType: 'answer_evaluated',
    mode: session.mode || payload.inputMode || 'text',
    payload: { inputMode: payload.inputMode || 'text' },
  }), { sessionId: session.id, workflowRunId });

  const singleBlockingLlmVoicePath = shouldUseSingleBlockingLlmVoicePath({ inputMode: payload.inputMode });
  const clientTurnId = payload.clientTurnId || null;
  
  // Check if optimizations are enabled for this session
  const optimizationsEnabled = isVoiceMode && voiceOptimizationConfig.isEnabledForSession(session.id);
  
  // Try to get warm context for voice mode
  let warmContext = null;
  if (optimizationsEnabled && clientTurnId && voiceOptimizationConfig.warmContextEnabled) {
    const warmContextService = (await import('./voice/voiceTurnWarmContextService.js')).default;
    warmContext = await warmContextService.getWarmContext({
      sessionId: session.id,
      questionId: payload.currentQuestionId || session.interviewPlan?.questions?.[session.currentQuestionIndex]?.id,
      clientTurnId,
      currentQuestionIndex: session.currentQuestionIndex,
      sessionStatus: session.status,
    });
    
    if (warmContext) {
      trace?.mark?.('adaptive.warm_context_hit', {
        cacheAge: warmContext.metadata?.cacheAge,
        preparationDuration: warmContext.metadata?.preparationDuration,
      });
    } else {
      trace?.mark?.('adaptive.warm_context_miss', { clientTurnId });
    }
  }

  let initialRetrievalBundle, baseEnvironment;
  
  if (warmContext) {
    // Use pre-warmed context (saves ~1.3s)
    initialRetrievalBundle = warmContext.retrievalBundle;
    baseEnvironment = warmContext.baseEnvironment;
    trace?.mark?.('adaptive.used_warm_context', {
      savedIndexing: true,
      savedRetrieval: true,
      savedEnvironment: true,
    });
  } else {
    // Fall back to original flow
    await measureAdaptiveStep(trace, 'adaptive.indexing_check', () => ensureSessionArtifactsIndexed(session.id));
    initialRetrievalBundle = await measureAdaptiveStep(trace, 'adaptive.retrieval', () => capabilityRegistry.retrieval(
      buildInterviewRetrievalInput({ session, payload, objective: 'bootstrap_interview_context' })
    ));
    baseEnvironment = await measureAdaptiveStep(trace, 'adaptive.environment_build', () => buildInterviewEnvironment({ session, retrievalBundle: initialRetrievalBundle }));
  }
  let latestAnswerUnderstanding;
  let localVoiceAnswerUnderstanding = null;
  const useVoiceAgentDecisionFastPath = isVoiceMode
    && optimizationsEnabled
    && typeof voiceOptimizationConfig.isAgentDecisionFastPathEnabled === 'function'
    && voiceOptimizationConfig.isAgentDecisionFastPathEnabled();

  if (singleBlockingLlmVoicePath) {
    const { extractFastAnswerUnderstanding } = await import('./aiControl/fastAnswerUnderstandingService.js');
    localVoiceAnswerUnderstanding = extractFastAnswerUnderstanding({
      session,
      environment: baseEnvironment,
      answerText: payload.answer || baseEnvironment.latestAnswer?.text || '',
    });
    latestAnswerUnderstanding = localVoiceAnswerUnderstanding;
    trace?.mark?.('adaptive.voice_single_llm_local_understanding', {
      source: 'local_js',
      technologiesCount: latestAnswerUnderstanding.technologies?.length || 0,
    });
  } else if (useVoiceAgentDecisionFastPath) {
    const { extractFastAnswerUnderstanding } = await import('./aiControl/fastAnswerUnderstandingService.js');
    localVoiceAnswerUnderstanding = extractFastAnswerUnderstanding({
      session,
      environment: baseEnvironment,
      answerText: payload.answer || baseEnvironment.latestAnswer?.text || '',
    });
    latestAnswerUnderstanding = localVoiceAnswerUnderstanding;
    trace?.mark?.('adaptive.voice_local_understanding', {
      source: 'local_js_seed',
      technologiesCount: latestAnswerUnderstanding.technologies?.length || 0,
    });
  } else if (optimizationsEnabled && voiceOptimizationConfig.isFastPathEnabled()) {
    // Rule-only fast path. Keep disabled by default because it removes model-assisted action selection.
    const { extractFastAnswerUnderstanding } = await import('./aiControl/fastAnswerUnderstandingService.js');
    latestAnswerUnderstanding = extractFastAnswerUnderstanding({
      session,
      environment: baseEnvironment,
      answerText: payload.answer || baseEnvironment.latestAnswer?.text || '',
    });
    trace?.mark?.('adaptive.voice_fast_path_understanding', {
      source: 'local_js',
      technologiesCount: latestAnswerUnderstanding.technologies?.length || 0,
    });
  } else {
    latestAnswerUnderstanding = await measureAdaptiveStep(trace, 'adaptive.fast_answer_understanding', () => resolveFastAnswerUnderstanding({
      session,
      environment: baseEnvironment,
      answerText: payload.answer || baseEnvironment.latestAnswer?.text || '',
    }));
  }
  const environment = {
    ...baseEnvironment,
    latestAnswerUnderstanding,
  };
  const evaluatorOutput = await measureAdaptiveStep(
    trace,
    'adaptive.turn_evaluation',
    () => capabilityRegistry.interviewEvaluator({ environment }),
  );
  enqueueBackgroundJob('persist-evaluator-record', () => persistEvaluatorRecord({ sessionId: session.id, evaluation: evaluatorOutput }), {
    sessionId: session.id,
    workflowRunId,
  });

  try {
    await recordAcceptedAnswerCoverage({
      sessionId: session.id,
      userId: session.userId,
      transcript: session.transcript,
      answerText: payload.answer || environment?.latestAnswer?.text || '',
      evaluation: evaluatorOutput,
    });
  } catch (error) {
    logger.warn('Accepted-answer question coverage update failed', {
      sessionId: session.id,
      userId: session.userId,
      error: error.message,
    });
  }

  let evidenceBundle;
  if (warmContext) {
    evidenceBundle = warmContext.evidenceBundle;
    trace?.mark?.('adaptive.used_warm_evidence_bundle');
  } else {
    evidenceBundle = await measureAdaptiveStep(trace, 'adaptive.evidence_bundle', () => buildEvidenceBundle({ session, retrievalBundle: initialRetrievalBundle }));
  }
  const decisionContext = await measureAdaptiveStep(trace, 'adaptive.decision_context', () => buildDecisionContext({
    taskType: 'interview_next_turn',
    session,
    retrievalBundle: initialRetrievalBundle,
    latestEvaluation: evaluatorOutput,
    latestAnswerUnderstanding,
  }));
  enqueueBackgroundJob('persist-controller-context', async () => {
    await persistDynamicSlotState({ sessionId: session.id, dynamicSlots: decisionContext.dynamicSlotState });
    await persistControllerSnapshot({ sessionId: session.id, decisionContext, evidenceBundle });
    await createDecisionRecord({
      sessionId: session.id,
      record: {
        taskType: 'interview_next_turn',
        workflowRunId,
        agent: 'master_controller',
tool: AGENT_TOOL_NAMES.RETRIEVE_INTERVIEW_EVIDENCE,
decisionType: AGENT_DECISION_TYPES.BUILD_CONTEXT,
        currentObjective: decisionContext.currentObjective,
        selectedAction: null,
        reasoningSummary: 'Built controller context from session state, retrieval evidence, transcript, and match analysis.',
        evidenceUsed: ['session.analysisResult', 'session.interviewPlan', 'retrievalBundle', 'transcript'],
        confidence: 0.85,
      },
    });
    await createDecisionRecord({
      sessionId: session.id,
      record: {
        taskType: 'interview_next_turn',
        workflowRunId,
        agent: 'interview_evaluator',
tool: AGENT_TOOL_NAMES.EVALUATE_CANDIDATE_ANSWER,
decisionType: AGENT_DECISION_TYPES.BUILD_CONTEXT,
        currentObjective: decisionContext.currentObjective,
        selectedAction: evaluatorOutput.suggestedNextMode || null,
        reasoningSummary: evaluatorOutput.rationale,
        evidenceUsed: [`topic:${evaluatorOutput.currentTopic}`, `evidence_gain:${evaluatorOutput.evidenceGainScore}`, `interaction:${evaluatorOutput.interactionStatus}`],
        confidence: evaluatorOutput.evidenceGainScore,
      },
    });
  }, { sessionId: session.id, workflowRunId });

  const fallbackPlan = await measureAdaptiveStep(trace, 'adaptive.action_selection', () => selectNextAction(decisionContext));
  
  let plan;
  if (singleBlockingLlmVoicePath) {
    plan = {
      ...fallbackPlan,
      selectionSource: 'voice_single_blocking_llm_rule_lane',
      modelSelectedAction: null,
      modelSelectionError: null,
    };
    trace?.mark?.('adaptive.voice_single_blocking_llm_policy', {
      selectedAction: plan.selectedAction,
      skippedBlockingModelActionSelection: true,
      liveBlockingLlmBudget: 1,
    });
  } else if (useVoiceAgentDecisionFastPath) {
    const voiceDecision = await measureAdaptiveStep(trace, 'adaptive.voice_agent_decision', () => resolveVoiceAgentDecisionOnce({
      decisionContext,
      evaluatorOutput,
      localUnderstanding: localVoiceAnswerUnderstanding || latestAnswerUnderstanding,
      candidateActions: fallbackPlan.candidateActions,
      fallbackPlan,
      sessionSettings: session.settings || {},
    }));
    latestAnswerUnderstanding = voiceDecision.latestAnswerUnderstanding || latestAnswerUnderstanding;
    plan = voiceDecision.plan;
    if (latestAnswerUnderstanding) {
      decisionContext.latestAnswerUnderstanding = latestAnswerUnderstanding;

      if (decisionContext.environment) {
        decisionContext.environment.latestAnswerUnderstanding = latestAnswerUnderstanding;
      }

      if (decisionContext.evaluatorState) {
        decisionContext.evaluatorState.fastAnswerUnderstanding = latestAnswerUnderstanding;
      }
    }
    trace?.mark?.('adaptive.voice_agent_decision_selected', {
      selectedAction: plan.selectedAction,
      selectionSource: plan.selectionSource,
      confidence: plan.confidence,
    });
  } else if (optimizationsEnabled && voiceOptimizationConfig.isFastPathEnabled()) {
    // Rule-only fast path. Keep disabled by default because it removes model-assisted action selection.
    plan = fallbackPlan;
    trace?.mark?.('adaptive.voice_fast_path_action_selection', {
      selectedAction: plan.selectedAction,
      source: 'rule_based',
    });
  } else {
    plan = await measureAdaptiveStep(trace, 'adaptive.model_action_selection', () => selectActionWithModel({
      decisionContext,
      evaluatorOutput,
      latestAnswerUnderstanding,
      candidateActions: fallbackPlan.candidateActions,
      fallbackPlan,
      sessionSettings: session.settings || {},
    }));
  }
  
  // For voice mode, schedule background quality path
  if (optimizationsEnabled && voiceOptimizationConfig.isBackgroundQualityEnabled()) {
    enqueueBackgroundJob('voice-turn-quality-path', async () => {
      try {
        // Run semantic understanding in background
        const semanticUnderstanding = await resolveFastAnswerUnderstanding({
          session,
          environment: baseEnvironment,
          answerText: payload.answer || baseEnvironment.latestAnswer?.text || '',
        });
        
        // Run model action selection in background
        const modelPlan = await selectActionWithModel({
          decisionContext,
          evaluatorOutput,
          latestAnswerUnderstanding: semanticUnderstanding,
          candidateActions: fallbackPlan.candidateActions,
          fallbackPlan,
          sessionSettings: session.settings || {},
        });
        
        // Update agent memory with semantic understanding
        await updateAgentMemory({
          workflowRunId,
          sessionId: session.id,
          questionId: payload.currentQuestionId,
          answer: payload.answer,
          understanding: semanticUnderstanding,
          modelPlan,
        });
        
        // Record background quality completion
        await recordAgentTraceEvent({
          sessionId: session.id,
          workflowRunId,
          eventType: 'voice_background_quality_completed',
          mode: 'duplex_voice',
          payload: {
            clientTurnId,
            semanticUnderstanding: {
              technologies: semanticUnderstanding.technologies?.length || 0,
              ownershipSignals: semanticUnderstanding.ownershipSignals?.length || 0,
            },
            modelPlan: {
              selectedAction: modelPlan.selectedAction,
              confidence: modelPlan.confidence,
            },
          },
        });
      } catch (error) {
        logger.error('Voice background quality path failed', {
          sessionId: session.id,
          clientTurnId,
          error: error.message,
        });
      }
    }, { sessionId: session.id, workflowRunId, priority: 'low' });
  }
  
  enqueueBackgroundJob('persist-action-selection-record', () => createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'interview_next_turn',
      workflowRunId,
      agent: 'master_controller',
tool: AGENT_TOOL_NAMES.PLAN_INTERVIEW_ACTION,
decisionType: AGENT_DECISION_TYPES.SELECT_ACTION,
      currentObjective: decisionContext.currentObjective,
      selectedAction: plan.selectedAction,
      reasoningSummary: `${plan.rationale}${plan.selectionSource ? ` Selection source: ${plan.selectionSource}.` : ''}`,
      evidenceUsed: [
        ...((decisionContext.coverageState?.missingTopics || []).map((item) => `coverage:${item}`)),
        ...((decisionContext.matchState?.validationTargets || []).map((item) => `validation:${item}`)),
        `specificity:${decisionContext.candidateState?.specificityLevel || 'unknown'}`,
        `fallback_action:${plan.fallbackAction || fallbackPlan.selectedAction}`,
        `selection_source:${plan.selectionSource || 'rule_fallback'}`,
      ],
      confidence: plan.confidence,
      actionInput: plan.actionInput,
      candidateActions: plan.candidateActions,
      fallbackAction: plan.fallbackAction || fallbackPlan.selectedAction,
      selectionSource: plan.selectionSource || 'rule_fallback',
      modelSelectedAction: plan.modelSelectedAction || null,
      modelSelectionError: plan.modelSelectionError || null,
    },
  }), { sessionId: session.id, workflowRunId });

  const interviewerOutput = await measureAdaptiveStep(trace, 'adaptive.action_execution', () => executeInterviewAction({
    selectedAction: plan.selectedAction,
    decisionContext,
    actionInput: plan.actionInput,
    agentRegistry: capabilityRegistry,
    session,
    onSentence,
  }));
  if (trace?.mark && interviewerOutput?.latency) {
    Object.entries(interviewerOutput.latency).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        trace.mark(`adaptive.question_${key}`, { value });
      }
    });
  }
  enqueueBackgroundJob('trace-followup-decision', () => recordAgentTraceEvent({
    sessionId: session.id,
    workflowRunId,
    eventType: 'followup_decision',
    mode: session.mode || payload.inputMode || 'text',
    payload: {
      selectedAction: plan.selectedAction,
      fallbackAction: plan.fallbackAction || fallbackPlan.selectedAction,
      selectionSource: plan.selectionSource || 'rule_fallback',
      plannerSignals: decisionContext.plannerSignals || evaluatorOutput.plannerSignals || {},
      candidateActions: plan.candidateActions || [],
      retrievalSources: decisionContext.retrievalState?.latestSources || [],
    },
  }), { sessionId: session.id, workflowRunId });

  enqueueBackgroundJob('persist-action-execution-record', () => createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'interview_next_turn',
      workflowRunId,
      agent: 'master_controller',
tool: getToolNameForAction(plan.selectedAction),
decisionType: AGENT_DECISION_TYPES.EXECUTE_ACTION,
      currentObjective: decisionContext.currentObjective,
      selectedAction: plan.selectedAction,
      reasoningSummary: interviewerOutput?.rationale || 'Executed interview action.',
      evidenceUsed: [interviewerOutput?.sourceType || 'agent_generated'],
      confidence: plan.confidence,
      actionInput: plan.actionInput,
      fallbackAction: plan.fallbackAction || fallbackPlan.selectedAction,
      selectionSource: plan.selectionSource || 'rule_fallback',
      candidateActions: plan.candidateActions,
    },
  }), { sessionId: session.id, workflowRunId });

  const trajectoryStep = buildTrajectoryStep({
    workflowRunId,
    session,
    environment: decisionContext.environment,
    decisionContext,
    selectedAction: plan.selectedAction,
    actionInput: plan.actionInput,
    plan,
    actorOutput: interviewerOutput,
    evaluatorOutput,
  });
  enqueueBackgroundJob('persist-trajectory-step', () => persistTrajectoryStep({ sessionId: session.id, step: trajectoryStep }), {
    sessionId: session.id,
    workflowRunId,
  });

  let reflectionRecord = null;
  if (shouldWriteReflection({ evaluatorState: evaluatorOutput, decisionContext, trajectoryStep })) {
    reflectionRecord = buildReflectionRecord({
      workflowRunId,
      sessionId: session.id,
      userId: session.userId,
      evaluatorState: evaluatorOutput,
      decisionContext,
      trajectoryStep,
    });
    enqueueBackgroundJob('persist-reflection-memory', async () => {
      await persistReflectionRecord({ sessionId: session.id, reflectionRecord });
      await rebuildBoundedMemory({ sessionId: session.id });
      await persistUserCoachingMemory({ userId: session.userId, reflectionRecord });
    }, { sessionId: session.id, userId: session.userId, workflowRunId });
  }

  enqueueBackgroundJob('update-agent-memory', () => updateAgentMemory({
    workflowRunId,
    sessionId: session.id,
    latestAnswer: payload.answer || decisionContext.latestAnswer,
    decisionContext,
    latestDecision: plan,
    outcome: interviewerOutput,
  }), { sessionId: session.id, workflowRunId });

  harnessObserver({
    decisionContext,
    fallbackPlan,
    plan,
    interviewerOutput,
    trajectoryStep,
    reflectionRecord,
  });

  if (interviewerOutput?.isComplete || !interviewerOutput?.nextQuestion) {
    return attachCatalogCoverageToCompletion({ session, result: {
      ...interviewerOutput,
      isComplete: true,
      completedBecause: interviewerOutput?.completedBecause || 'question_limit_reached',
      nextQuestion: null,
      nextQuestionOrder: session.currentQuestionIndex,
      evaluatorOutput,
      reactTrace: interviewerOutput?.reactTrace || null,
      reflectionRecord,
    } });
  }

  const transcriptMetadata = buildQuestionTranscriptMetadata(interviewerOutput);
  const nextQuestionOrder = getNextQuestionOrder(session, { countsAsQuestion: transcriptMetadata.countsAsQuestion });
  const resolvedQuestionSource = interviewerOutput.sourceType || interviewerOutput.questionDecision?.sourceType || 'agent_generated';
  const parentQuestionId = transcriptMetadata.parentQuestionId
    || [...(session.transcript || [])].reverse().find((turn) => turn.role === 'ai' && turn.metadata?.countsAsQuestion !== false)?.questionId
    || null;
  const questionId = transcriptMetadata.countsAsQuestion
    ? await createInterviewQuestion({
        sessionId: session.id,
        questionOrder: nextQuestionOrder,
        questionType: interviewerOutput.questionType || 'follow_up',
        sourceType: resolvedQuestionSource,
        questionText: interviewerOutput.displayText || interviewerOutput.nextQuestion,
        basedOnCv: ['cv_template', 'match_gap', 'cv_seed', 'prepared_question_pool', 'cv_project', 'cv_skill', 'cv_behavioural', 'cv_achievement', 'cv_transition', 'cv_experience'].includes(resolvedQuestionSource),
        basedOnJd: ['jd_requirement', 'match_gap', 'jd_filter', 'universal_requirement_competency', 'match_validation'].includes(resolvedQuestionSource),
      })
    : parentQuestionId;
  const preparedQuestionId = interviewerOutput?.questionDecision?.preparedQuestionId || interviewerOutput?.preparedQuestionId || null;
  if (shouldMarkPreparedRootQuestionAsked({ interviewerOutput })) {
    await persistPreparedRootQuestionSelection({
      session,
      preparedQuestionId,
      nextQuestionOrder,
      questionDecision: interviewerOutput.questionDecision || {},
    });
  }

  await appendTranscriptTurn(session.id, {
    role: 'ai',
    text: interviewerOutput.displayText || interviewerOutput.nextQuestion,
    timestamp: new Date().toISOString(),
    questionId,
    metadata: {
      ...transcriptMetadata,
      stage: interviewerOutput.stage,
      topic: interviewerOutput.topic,
      evidenceTypeHint: interviewerOutput.evidenceTypeHint || null,
      controllerAction: plan.selectedAction,
      fallbackAction: plan.fallbackAction || fallbackPlan.selectedAction,
      selectionSource: plan.selectionSource || 'rule_fallback',
      rationaleSummary: interviewerOutput.rationaleSummary || interviewerOutput.rationale,
      preamble: interviewerOutput.interviewerTurn?.preamble || '',
      followUpDepth: interviewerOutput.followUpDepth || 0,
      questionCategory: interviewerOutput.questionCategory || null,
      questionType: interviewerOutput.questionType || 'follow_up',
      questionDecision: interviewerOutput.questionDecision || null,
      questionRanking: interviewerOutput.questionRanking || interviewerOutput.questionDecision?.ranking || null,
      turnKind: interviewerOutput.turnKind || interviewerOutput.questionDecision?.turnKind || null,
      scenario: interviewerOutput.scenario || interviewerOutput.questionDecision?.scenario || null,
      sourcePolicy: interviewerOutput.sourcePolicy || interviewerOutput.questionDecision?.sourcePolicy || null,
      preparedQuestionId,
      parentQuestionId: interviewerOutput.parentQuestionId || interviewerOutput.questionDecision?.parentQuestionId || null,
      parentPreparedQuestionId: interviewerOutput.parentPreparedQuestionId || interviewerOutput.questionDecision?.parentPreparedQuestionId || null,
      rootQuestionId: interviewerOutput.rootQuestionId || interviewerOutput.questionDecision?.rootQuestionId || null,
      rootTopic: interviewerOutput.rootTopic || interviewerOutput.questionDecision?.rootTopic || null,
      followUpIntent: interviewerOutput.followUpIntent || interviewerOutput.questionDecision?.followUpIntent || null,
      evidenceTarget: interviewerOutput.evidenceTarget || interviewerOutput.questionDecision?.evidenceTarget || null,
      rankTrace: interviewerOutput.rankTrace || interviewerOutput.questionDecision?.rankTrace || null,
      poolDegraded: Boolean(interviewerOutput.poolDegraded || interviewerOutput.questionDecision?.poolDegraded),
      poolDegradedReason: interviewerOutput.poolDegradedReason || interviewerOutput.questionDecision?.poolDegradedReason || null,
      selectedAngle: interviewerOutput.questionDecision?.selectedAngle || null,
      shortReason: interviewerOutput.questionDecision?.shortReason || null,
      latency: interviewerOutput.latency || interviewerOutput.questionDecision?.latency || null,
      whyThisQuestion: interviewerOutput.questionDecision?.whyThisQuestion || interviewerOutput.rationaleSummary || interviewerOutput.rationale || null,
      evidenceUsed: interviewerOutput.questionDecision?.evidenceUsed || [],
      baseQuestionText: interviewerOutput.questionDecision?.baseQuestionText || interviewerOutput.nextQuestion || null,
      spokenQuestionText: interviewerOutput.displayText || interviewerOutput.nextQuestion || null,
    },
  });

  return {
    ...interviewerOutput,
    nextQuestionOrder,
    isComplete: false,
    controllerAction: plan.selectedAction,
    fallbackAction: plan.fallbackAction || fallbackPlan.selectedAction,
    selectionSource: plan.selectionSource || 'rule_fallback',
    evaluatorOutput,
    interviewerTurn: interviewerOutput.interviewerTurn || null,
    reactTrace: interviewerOutput.reactTrace || null,
  };
};

const runReportController = async ({
  session,
  workflowRunId = null,
  harnessObserver = () => {},
  capabilityRegistry = agentRegistry,
}) => {
  await recordAgentTraceEvent({
    sessionId: session.id,
    workflowRunId,
    eventType: 'report_generation_started',
    mode: session.mode || 'text',
    payload: { taskType: 'generate_report' },
  });
  const indexingStatus = await indexReportSessionArtifactsSafely({ sessionId: session.id });
  const retrievalBundle = await capabilityRegistry.retrieval({
    query: buildDefaultRetrievalQuery({ session, mode: 'report' }),
    sessionId: session.id,
    sourceTypes: ['cv_profile', 'jd_rubric', 'interview_plan', 'prepared_question_pool', 'transcript'],
    topK: 8,
    objective: 'ground_report_generation',
    targetTopic: 'report',
  });

  const evidenceBundle = buildEvidenceBundle({ session, retrievalBundle });
  const decisionContext = await buildDecisionContext({
    taskType: 'generate_report',
    session,
    retrievalBundle,
  });

  await persistControllerSnapshot({ sessionId: session.id, decisionContext, evidenceBundle });
  await createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'generate_report',
      workflowRunId,
      agent: 'master_controller',
tool: AGENT_TOOL_NAMES.RETRIEVE_INTERVIEW_EVIDENCE,
decisionType: AGENT_DECISION_TYPES.BUILD_CONTEXT,
      currentObjective: decisionContext.currentObjective,
      selectedAction: null,
      reasoningSummary: 'Built report controller context from session evidence and interview transcript.',
      evidenceUsed: [
        'session.analysisResult',
        'session.interviewPlan',
        'retrievalBundle',
        'transcript',
        indexingStatus.ok ? 'rag_indexing:ready' : 'rag_indexing:degraded',
      ],
      confidence: 0.86,
    },
  });

  const plan = selectNextAction(decisionContext);
  await createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'generate_report',
      workflowRunId,
      agent: 'master_controller',
tool: AGENT_TOOL_NAMES.PLAN_INTERVIEW_ACTION,
decisionType: AGENT_DECISION_TYPES.SELECT_ACTION,
      currentObjective: decisionContext.currentObjective,
      selectedAction: plan.selectedAction,
      reasoningSummary: plan.rationale,
      evidenceUsed: [
        ...((decisionContext.matchState?.missingRequiredSkills || []).map((item) => `gap:${item}`)),
        `retrieval:${decisionContext.retrievalState?.sourceQuality || 'unknown'}`,
      ],
      confidence: plan.confidence,
    },
  });

  const executionResult = await executeReportAction({
    selectedAction: plan.selectedAction,
    decisionContext,
    agentRegistry: capabilityRegistry,
    session,
    retrievalBundle,
  });
  await Promise.all([
    recordLocalUsage({
      userId: session.userId,
      sessionId: session.id,
      stage: 'report_generated',
      operation: 'local_parse',
      metadata: { source: 'report_controller' },
    }),
    recordLocalUsage({
      userId: session.userId,
      sessionId: session.id,
      stage: 'report_qa',
      operation: 'local_parse',
      metadata: { source: 'report_controller' },
    }),
  ]);

  await createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'generate_report',
      workflowRunId,
      agent: 'master_controller',
tool: getToolNameForAction(plan.selectedAction),
decisionType: AGENT_DECISION_TYPES.EXECUTE_ACTION,
      currentObjective: decisionContext.currentObjective,
      selectedAction: plan.selectedAction,
      reasoningSummary: 'Generated a grounded report draft and ran QA checks.',
      evidenceUsed: ['report_generator', 'report_qa'],
      confidence: plan.confidence,
    },
  });

  const stored = await persistReportArtifact({
    sessionId: session.id,
    userId: session.userId,
    report: executionResult.report,
    qaResult: executionResult.qaResult,
    repairHistory: executionResult.repairHistory || [],
  });
  await cleanupQuestionArtifactsForCompletedReport({ session });
  await recordAgentTraceEvent({
    sessionId: session.id,
    workflowRunId,
    eventType: 'report_generation_completed',
    mode: session.mode || 'text',
    payload: {
      qaPassed: executionResult.qaResult?.passed,
      coverageScore: executionResult.qaResult?.coverageScore,
      claimEvidence: executionResult.report?.evidenceDiagnostics?.claimEvidence || {},
    },
  });

  harnessObserver({
    qaResult: executionResult.qaResult,
    repairHistory: executionResult.repairHistory || [],
    storedStatus: stored?.latestStatus || null,
    selectedAction: plan.selectedAction,
  });

  return { report: executionResult.report, qaResult: executionResult.qaResult, stored, controllerAction: plan.selectedAction };
};

const runReportQaController = async ({
  session,
  workflowRunId = null,
  harnessObserver = () => {},
  capabilityRegistry = agentRegistry,
}) => {
  const stored = await SessionReport.findOne({ sessionId: session.id }).lean();
  if (!stored?.report) {
    throw new Error('Report not found');
  }

  await indexReportSessionArtifactsSafely({ sessionId: session.id });
  const retrievalBundle = await capabilityRegistry.retrieval({
    query: `${session.targetRole} report qa evidence`,
    sessionId: session.id,
    sourceTypes: ['cv_profile', 'jd_rubric', 'interview_plan', 'prepared_question_pool', 'transcript'],
    topK: 8,
    objective: 'qa_existing_report',
    targetTopic: 'report',
  });

  const qaResult = await capabilityRegistry.reportQa({
    report: stored.report,
    analysisResult: session.analysisResult || {},
    retrievalBundle,
  });
  await recordLocalUsage({
    userId: session.userId,
    sessionId: session.id,
    stage: 'report_qa',
    operation: 'local_parse',
    metadata: { source: 'manual_report_qa' },
  });
  const updated = await persistReportArtifact({
    sessionId: session.id,
    userId: session.userId,
    report: stored.report,
    qaResult,
  });
  await recordAgentTraceEvent({
    sessionId: session.id,
    workflowRunId,
    eventType: 'report_qa_completed',
    mode: session.mode || 'text',
    payload: { qaPassed: qaResult?.passed, qualityFlagCount: qaResult?.qualityFlags?.length || 0 },
  });
  harnessObserver({
    qaResult,
    repairHistory: [],
    storedStatus: updated?.latestStatus || null,
    selectedAction: 'QA_REPORT',
  });
  return { report: stored.report, qaResult, stored: updated };
};


export const warmAdaptiveSession = async ({ sessionId, trace = null } = {}) => {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  await measureAdaptiveStep(trace, 'warm_adaptive.question_reconciliation', () => reconcileQuestionPoolFromTranscript({
    sessionId: session.id,
    transcript: session.transcript,
  }));
  await measureAdaptiveStep(trace, 'warm_adaptive.indexing_check', () => ensureSessionArtifactsIndexed(session.id));
  const retrievalBundle = await measureAdaptiveStep(trace, 'warm_adaptive.retrieval', () => agentRegistry.retrieval(
    buildInterviewRetrievalInput({ session, payload: {}, objective: 'warm_adaptive_session' })
  ));
  const environment = await measureAdaptiveStep(trace, 'warm_adaptive.environment_build', () => buildInterviewEnvironment({ session, retrievalBundle }));
  await measureAdaptiveStep(trace, 'warm_adaptive.evidence_bundle', () => buildEvidenceBundle({ session, retrievalBundle }));
  const userInterviewMemoryProjection = await measureAdaptiveStep(
    trace,
    'warm_adaptive.user_interview_memory_projection',
    () => refreshUserInterviewMemoryProjection({
      userId: session.userId,
      currentSessionId: session.id,
      currentRoleKey: session.analysisResult?.matchingDetails?.questionPlanHints?.roleCanonical || session.targetRole,
      planningEnabled: isUserInterviewMemoryPlanningEnabled(),
    })
  );

  return {
    warmed: true,
    sessionId: session.id,
    retrievalCount: Array.isArray(retrievalBundle?.items) ? retrievalBundle.items.length : 0,
    hasEnvironment: Boolean(environment),
    userInterviewMemoryProjection: userInterviewMemoryProjection
      ? {
          schemaVersion: userInterviewMemoryProjection.schemaVersion,
          planningEnabled: userInterviewMemoryProjection.planningEnabled,
          promotedCompetencyCount: userInterviewMemoryProjection.routineRepeatSuppressions.length,
          revalidationCount: userInterviewMemoryProjection.revalidationDue.length,
        }
      : null,
  };
};

export const runTask = async ({ taskType, sessionId, payload = {}, onSentence = null, trace = null } = {}) => {
  if (!taskType) {
    throw new Error('taskType is required');
  }

  if (taskType === 'interview_next_turn') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return runInterviewNextTurnWithShadowHarness({
      enabled: isHarnessShadowEnabled(),
      executionMode: getHarnessExecutionMode(),
      session,
      payload,
      capabilityRegistry: agentRegistry,
      executeController: ({ observe, workflowRunId, capabilityRegistry }) => runInterviewController({
        session,
        payload,
        onSentence,
        trace,
        workflowRunId,
        harnessObserver: observe,
        capabilityRegistry,
      }),
      appendRun: scheduleHarnessRunPersistence,
    });
  }

  if (taskType === 'generate_report') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return runReportTaskWithHarness({
      enabled: isHarnessShadowEnabled(),
      executionMode: getHarnessExecutionMode(),
      taskType,
      session,
      capabilityRegistry: agentRegistry,
      executeController: ({ workflowRunId, observe, capabilityRegistry }) => runReportController({
        session,
        workflowRunId,
        harnessObserver: observe,
        capabilityRegistry,
      }),
      appendRun: scheduleHarnessRunPersistence,
    });
  }

  if (taskType === 'qa_report') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    return runReportTaskWithHarness({
      enabled: isHarnessShadowEnabled(),
      executionMode: getHarnessExecutionMode(),
      taskType,
      session,
      capabilityRegistry: agentRegistry,
      executeController: ({ workflowRunId, observe, capabilityRegistry }) => runReportQaController({
        session,
        workflowRunId,
        harnessObserver: observe,
        capabilityRegistry,
      }),
      appendRun: scheduleHarnessRunPersistence,
    });
  }

  throw new Error(`Unsupported task type: ${taskType}`);
};
