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
import { agentRegistry } from './agentRegistryService.js';
import { getSessionById, appendTranscriptTurn, createInterviewQuestion } from './sessionService.js';
import { getNextQuestionOrder, hasReachedQuestionLimit } from './interviewStateService.js';
import { indexSessionArtifacts, ensureSessionArtifactsIndexed } from './ragIndexService.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { SessionReport } from '../db/models/sessionReportModel.js';
import { buildDecisionContext } from './aiControl/decisionContextBuilder.js';
import { buildInterviewEnvironment } from './aiControl/interviewEnvironmentService.js';
import { createDecisionRecord } from './aiControl/decisionRecordService.js';
import { selectNextAction } from './aiControl/actionPlanner.js';
import { updateAgentMemory } from './aiControl/agentMemoryService.js';
import { executeInterviewAction } from './aiControl/interviewActionExecutor.js';
import { evaluateInterviewTurn, persistEvaluatorRecord } from './aiControl/interviewEvaluatorService.js';
import { buildTrajectoryStep, persistTrajectoryStep } from './aiControl/trajectoryService.js';
import { executeReportAction } from './aiControl/reportActionExecutor.js';
import { buildEvidenceBundle } from './aiControl/evidenceBundleService.js';
import { persistDynamicSlotState } from './aiControl/dynamicSlotService.js';
import { buildReflectionRecord, shouldWriteReflection, persistReflectionRecord } from './aiControl/reflectionWriterService.js';
import { persistUserCoachingMemory } from './aiControl/userCoachingMemoryService.js';
import { rebuildBoundedMemory } from './aiControl/experienceMemoryService.js';
import { enqueueBackgroundJob } from '../jobs/backgroundJobQueue.js';

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

const persistReportArtifact = async ({ sessionId, report, qaResult }) => {
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $push: {
        reportArtifacts: {
          createdAt: new Date(),
          report,
          qaResult,
        },
      },
    },
    { upsert: true }
  );

  return SessionReport.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      report,
      qaResult,
      latestStatus: qaResult?.passed ? 'ready' : 'needs_review',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const buildDefaultRetrievalQuery = ({ session = {}, payload = {}, mode = 'interview' } = {}) => {
  const roleCanonical = session.analysisResult?.matchingDetails?.questionPlanHints?.roleCanonical || '';
  const interviewFocus = (session.analysisResult?.interviewFocus || []).join(' ');
  const answerSlice = (payload.answer || '').slice(0, 300);
  if (mode === 'report') {
    return `${session.targetRole || ''} ${roleCanonical} report summary evidence transcript support`.trim();
  }
  return `${session.targetRole || ''} ${roleCanonical} ${interviewFocus} ${answerSlice}`.trim();
};

const runInterviewController = async ({ session, payload = {}, onSentence = null }) => {
  if (hasReachedQuestionLimit(session)) {
    return {
      isComplete: true,
      completedBecause: 'question_limit_reached',
      nextQuestion: null,
      nextQuestionOrder: session.currentQuestionIndex,
      rationale: 'Interview completed after the planned question limit.',
      retrievalSnapshot: null,
    };
  }

  await ensureSessionArtifactsIndexed(session.id);
  const initialRetrievalBundle = await agentRegistry.retrieval({
    query: buildDefaultRetrievalQuery({ session, payload, mode: 'interview' }),
    sessionId: session.id,
    sourceTypes: ['question_bank', 'behavioural_bank', 'interview_plan', 'jd_rubric', 'cv_profile', 'transcript'],
    topK: 5,
    objective: 'bootstrap_interview_context',
    targetTopic: session.targetRole,
  });

  const environment = buildInterviewEnvironment({ session, retrievalBundle: initialRetrievalBundle });
  const evaluatorOutput = evaluateInterviewTurn({ environment });
  enqueueBackgroundJob('persist-evaluator-record', () => persistEvaluatorRecord({ sessionId: session.id, evaluation: evaluatorOutput }), { sessionId: session.id });

  const evidenceBundle = buildEvidenceBundle({ session, retrievalBundle: initialRetrievalBundle });
  const decisionContext = await buildDecisionContext({
    taskType: 'interview_next_turn',
    session,
    retrievalBundle: initialRetrievalBundle,
    latestEvaluation: evaluatorOutput,
  });
  enqueueBackgroundJob('persist-controller-context', async () => {
    await persistDynamicSlotState({ sessionId: session.id, dynamicSlots: decisionContext.dynamicSlotState });
    await persistControllerSnapshot({ sessionId: session.id, decisionContext, evidenceBundle });
    await createDecisionRecord({
      sessionId: session.id,
      record: {
        taskType: 'interview_next_turn',
        agent: 'master_controller',
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
        agent: 'interview_evaluator',
        decisionType: AGENT_DECISION_TYPES.BUILD_CONTEXT,
        currentObjective: decisionContext.currentObjective,
        selectedAction: evaluatorOutput.suggestedNextMode || null,
        reasoningSummary: evaluatorOutput.rationale,
        evidenceUsed: [`topic:${evaluatorOutput.currentTopic}`, `evidence_gain:${evaluatorOutput.evidenceGainScore}`, `interaction:${evaluatorOutput.interactionStatus}`],
        confidence: evaluatorOutput.evidenceGainScore,
      },
    });
  }, { sessionId: session.id });

  const plan = selectNextAction(decisionContext);
  enqueueBackgroundJob('persist-action-selection-record', () => createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'interview_next_turn',
      agent: 'master_controller',
      decisionType: AGENT_DECISION_TYPES.SELECT_ACTION,
      currentObjective: decisionContext.currentObjective,
      selectedAction: plan.selectedAction,
      reasoningSummary: plan.rationale,
      evidenceUsed: [
        ...((decisionContext.coverageState?.missingTopics || []).map((item) => `coverage:${item}`)),
        ...((decisionContext.matchState?.validationTargets || []).map((item) => `validation:${item}`)),
        `specificity:${decisionContext.candidateState?.specificityLevel || 'unknown'}`,
      ],
      confidence: plan.confidence,
    },
  }), { sessionId: session.id });

  const interviewerOutput = await executeInterviewAction({
    selectedAction: plan.selectedAction,
    decisionContext,
    actionInput: plan.actionInput,
    agentRegistry,
    session,
    onSentence,
  });

  enqueueBackgroundJob('persist-action-execution-record', () => createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'interview_next_turn',
      agent: 'master_controller',
      decisionType: AGENT_DECISION_TYPES.EXECUTE_ACTION,
      currentObjective: decisionContext.currentObjective,
      selectedAction: plan.selectedAction,
      reasoningSummary: interviewerOutput?.rationale || 'Executed interview action.',
      evidenceUsed: [interviewerOutput?.sourceType || 'agent_generated'],
      confidence: plan.confidence,
      actionInput: plan.actionInput,
    },
  }), { sessionId: session.id });

  const trajectoryStep = buildTrajectoryStep({
    session,
    environment: decisionContext.environment,
    decisionContext,
    selectedAction: plan.selectedAction,
    actionInput: plan.actionInput,
    actorOutput: interviewerOutput,
    evaluatorOutput,
  });
  enqueueBackgroundJob('persist-trajectory-step', () => persistTrajectoryStep({ sessionId: session.id, step: trajectoryStep }), { sessionId: session.id });

  let reflectionRecord = null;
  if (shouldWriteReflection({ evaluatorState: evaluatorOutput, decisionContext, trajectoryStep })) {
    reflectionRecord = buildReflectionRecord({
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
    }, { sessionId: session.id, userId: session.userId });
  }

  enqueueBackgroundJob('update-agent-memory', () => updateAgentMemory({
    sessionId: session.id,
    latestAnswer: payload.answer || decisionContext.latestAnswer,
    decisionContext,
    latestDecision: plan,
    outcome: interviewerOutput,
  }), { sessionId: session.id });

  if (interviewerOutput?.isComplete || !interviewerOutput?.nextQuestion) {
    return {
      ...interviewerOutput,
      isComplete: true,
      completedBecause: interviewerOutput?.completedBecause || 'question_limit_reached',
      nextQuestion: null,
      nextQuestionOrder: session.currentQuestionIndex,
      evaluatorOutput,
      reactTrace: interviewerOutput?.reactTrace || null,
      reflectionRecord,
    };
  }

  const nextQuestionOrder = getNextQuestionOrder(session);
  const questionId = await createInterviewQuestion({
    sessionId: session.id,
    questionOrder: nextQuestionOrder,
    questionType: interviewerOutput.questionType || 'follow_up',
    sourceType: interviewerOutput.sourceType || 'agent_generated',
    questionText: interviewerOutput.displayText || interviewerOutput.nextQuestion,
    basedOnCv: true,
    basedOnJd: true,
  });

  await appendTranscriptTurn(session.id, {
    role: 'ai',
    text: interviewerOutput.displayText || interviewerOutput.nextQuestion,
    timestamp: new Date().toISOString(),
    questionId,
    metadata: {
      stage: interviewerOutput.stage,
      topic: interviewerOutput.topic,
      evidenceTypeHint: interviewerOutput.evidenceTypeHint || null,
      controllerAction: plan.selectedAction,
      rationaleSummary: interviewerOutput.rationaleSummary || interviewerOutput.rationale,
      preamble: interviewerOutput.interviewerTurn?.preamble || '',
      followUpDepth: interviewerOutput.followUpDepth || 0,
      questionCategory: interviewerOutput.questionCategory || null,
      questionType: interviewerOutput.questionType || 'follow_up',
    },
  });

  return {
    ...interviewerOutput,
    nextQuestionOrder,
    isComplete: false,
    controllerAction: plan.selectedAction,
    evaluatorOutput,
    interviewerTurn: interviewerOutput.interviewerTurn || null,
    reactTrace: interviewerOutput.reactTrace || null,
  };
};

const runReportController = async ({ session }) => {
  await indexSessionArtifacts(session.id);
  const retrievalBundle = await agentRegistry.retrieval({
    query: buildDefaultRetrievalQuery({ session, mode: 'report' }),
    sessionId: session.id,
    sourceTypes: ['cv_profile', 'jd_rubric', 'interview_plan', 'transcript'],
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
      agent: 'master_controller',
      decisionType: AGENT_DECISION_TYPES.BUILD_CONTEXT,
      currentObjective: decisionContext.currentObjective,
      selectedAction: null,
      reasoningSummary: 'Built report controller context from session evidence and interview transcript.',
      evidenceUsed: ['session.analysisResult', 'session.interviewPlan', 'retrievalBundle', 'transcript'],
      confidence: 0.86,
    },
  });

  const plan = selectNextAction(decisionContext);
  await createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'generate_report',
      agent: 'master_controller',
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
    agentRegistry,
    session,
    retrievalBundle,
  });

  await createDecisionRecord({
    sessionId: session.id,
    record: {
      taskType: 'generate_report',
      agent: 'master_controller',
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
    report: executionResult.report,
    qaResult: executionResult.qaResult,
  });

  return { report: executionResult.report, qaResult: executionResult.qaResult, stored, controllerAction: plan.selectedAction };
};

export const runTask = async ({ taskType, sessionId, payload = {}, onSentence = null } = {}) => {
  if (!taskType) {
    throw new Error('taskType is required');
  }

  if (taskType === 'interview_next_turn') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return runInterviewController({ session, payload, onSentence });
  }

  if (taskType === 'generate_report') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    return runReportController({ session });
  }

  if (taskType === 'qa_report') {
    const session = await getSessionById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const stored = await SessionReport.findOne({ sessionId }).lean();
    if (!stored?.report) {
      throw new Error('Report not found');
    }

    await indexSessionArtifacts(session.id);
    const retrievalBundle = await agentRegistry.retrieval({
      query: `${session.targetRole} report qa evidence`,
      sessionId: session.id,
      sourceTypes: ['cv_profile', 'jd_rubric', 'interview_plan', 'transcript'],
      topK: 8,
      objective: 'qa_existing_report',
      targetTopic: 'report',
    });

    const qaResult = await agentRegistry.reportQa({
      report: stored.report,
      analysisResult: session.analysisResult || {},
      retrievalBundle,
    });
    const updated = await persistReportArtifact({ sessionId: session.id, report: stored.report, qaResult });
    return { report: stored.report, qaResult, stored: updated };
  }

  throw new Error(`Unsupported task type: ${taskType}`);
};
