import { enqueueBackgroundJob } from '../../jobs/backgroundJobQueue.js';
import { logger } from '../../utils/logger.js';
import { recordAgentTraceEvent } from '../aiControl/agentTraceService.js';
import { getNextQuestionOrder } from '../interviewStateService.js';
import {
  appendTranscriptTurn,
  createInterviewQuestion,
  updateLatestTranscriptTurnMetadata,
} from '../sessionService.js';
import { markQuestionPoolItemAsked } from '../questions/questionPoolComposerService.js';
import {
  buildQuestionScopeTracePayload,
  QUESTION_SCOPE_TURN_TYPES,
} from './questionScopeClarificationService.js';

export const buildQuestionScopeRequestMetadata = (observation = {}) => ({
  turnType: observation.requestTurnType || QUESTION_SCOPE_TURN_TYPES.REQUEST,
  countsAsQuestion: false,
  countsAsAnswer: false,
  parentQuestionId: observation.parentQuestionId || observation.rootQuestionId || null,
  rootQuestionId: observation.rootQuestionId || null,
  preparedQuestionId: observation.preparedQuestionId || null,
  catalogQuestionId: observation.catalogQuestionId || null,
  ambiguityMode: observation.ambiguityMode || null,
  clarificationContextVersion: observation.clarificationContextVersion || null,
  scopeResponseReason: observation.scopeResponseReason || null,
  clarificationIntent: observation.intentType || null,
});

const resolveScenario = (observation = {}) => {
  if (observation.kind === 'skip_question_request' && observation.nextQuestion) {
    return 'switch_topic';
  }
  if (observation.turnType === QUESTION_SCOPE_TURN_TYPES.RESPONSE) {
    return 'question_scope_clarification';
  }
  return observation.actionType === 'ASK_SCAFFOLD_QUESTION' ? 'scaffold' : 'rephrase';
};

const resolvePreservedQuestionOrder = (session = {}) => {
  const currentQuestionIndex = Number(session.currentQuestionIndex);
  return Number.isFinite(currentQuestionIndex)
    ? currentQuestionIndex
    : getNextQuestionOrder(session, { countsAsQuestion: false });
};
const resolveFreshRootQuestionOrder = (session = {}) => {
  const currentQuestionIndex = Number(session.currentQuestionIndex);

  if (Number.isFinite(currentQuestionIndex)) {
    return currentQuestionIndex + 1;
  }

  return getNextQuestionOrder(session, { countsAsQuestion: true });
};
export const buildQuestionScopeControllerOutput = ({ session = {}, observation = {} } = {}) => {
  const responseText = String(observation.responseText || '').trim();
  const scenario = resolveScenario(observation);
  const skippedToNextQuestion = observation.kind === 'skip_question_request'
    && Boolean(observation.nextQuestion);
  const nextRootQuestionId = skippedToNextQuestion
    ? observation.nextRootQuestionId
    : observation.rootQuestionId;
  const questionDecision = {
    turnKind: 'repair',
    scenario,
    sourcePolicy: observation.clarificationContextVersion
      ? 'versioned_prepared_scope_context'
      : 'deterministic_scope_fallback',
    parentQuestionId: skippedToNextQuestion
      ? null
      : observation.parentQuestionId || observation.rootQuestionId || null,
    rootQuestionId: nextRootQuestionId || null,
    preparedQuestionId: skippedToNextQuestion
      ? observation.nextQuestion?.preparedQuestionId || observation.nextQuestion?.questionId || null
      : observation.preparedQuestionId || null,
    catalogQuestionId: skippedToNextQuestion
      ? observation.nextQuestion?.catalogQuestionId || null
      : observation.catalogQuestionId || null,
    ambiguityMode: observation.ambiguityMode || null,
    clarificationContextVersion: observation.clarificationContextVersion || null,
    scopeResponseReason: observation.scopeResponseReason || null,
    clarificationIntent: observation.intentType || null,
  };

  return {
    questionType: skippedToNextQuestion
      ? observation.nextQuestion?.questionType || observation.nextQuestion?.type || 'interview_question'
      : 'question_scope_clarification',
    nextQuestion: responseText,
    displayText: responseText,
    interviewerTurn: {
      feedbackMode: 'deterministic_scope_clarification',
      preamble: '',
      question: responseText,
      displayText: responseText,
    },
    rationale: skippedToNextQuestion
      ? 'Skipped the active question without scoring it and moved to the next prepared question.'
      : 'Answered a candidate scope question without advancing the active interview question.',
    rationaleSummary: skippedToNextQuestion
      ? 'Preserved answer eligibility while moving to a fresh root question.'
      : 'Kept the active root question while resolving or bounding its scope.',
    stage: skippedToNextQuestion ? observation.nextQuestion?.stage || null : observation.stage || null,
    topic: skippedToNextQuestion ? observation.nextQuestion?.topic || null : observation.topic || null,
    questionCategory: skippedToNextQuestion
      ? observation.nextQuestion?.category || null
      : observation.questionCategory || null,
    turnKind: skippedToNextQuestion ? 'root_question' : 'repair',
    turnType: observation.turnType,
    scenario,
    sourcePolicy: questionDecision.sourcePolicy,
    parentQuestionId: questionDecision.parentQuestionId,
    rootQuestionId: questionDecision.rootQuestionId,
    preparedQuestionId: questionDecision.preparedQuestionId,
    catalogQuestionId: questionDecision.catalogQuestionId,
    ambiguityMode: questionDecision.ambiguityMode,
    clarificationContextVersion: questionDecision.clarificationContextVersion,
    scopeResponseReason: questionDecision.scopeResponseReason,
    clarificationIntent: questionDecision.clarificationIntent,
    questionDecision,
    nextQuestionOrder: skippedToNextQuestion
      ? resolveFreshRootQuestionOrder(session)
      : resolvePreservedQuestionOrder(session),
    controllerAction: observation.actionType,
    fallbackAction: observation.actionType,
    selectionSource: 'deterministic_question_scope_policy',
    evaluatorOutput: null,
    isComplete: false,
  };
};

export const persistExplicitAssumptionFraming = ({
  sessionId,
  observation = {},
} = {}) => updateLatestTranscriptTurnMetadata(sessionId, 'user', {
  scopeFraming: 'explicit_assumption',
  rootQuestionId: observation.rootQuestionId,
  preparedQuestionId: observation.preparedQuestionId || null,
  catalogQuestionId: observation.catalogQuestionId || null,
  ambiguityMode: observation.ambiguityMode,
  countsAsAnswer: true,
});

export const executeQuestionScopeControllerTurn = async ({
  session,
  observation,
  onSentence,
  workflowRunId,
  harnessObserver = () => {},
} = {}) => {
  const result = buildQuestionScopeControllerOutput({ session, observation });
  const confidence = observation.kind === 'scope_request' ? 1 : 0.85;
  const plan = {
    selectedAction: observation.actionType,
    fallbackAction: observation.actionType,
    selectionSource: 'deterministic_question_scope_policy',
    confidence,
    actionInput: {
      rootQuestionId: observation.rootQuestionId,
      clarificationContextVersion: observation.clarificationContextVersion || null,
    },
    candidateActions: [{ action: observation.actionType, confidence }],
  };

  await updateLatestTranscriptTurnMetadata(
    session.id,
    'user',
    buildQuestionScopeRequestMetadata(observation),
  );
  await onSentence?.(result.displayText, 0);
  const isFreshRootQuestion = result.turnKind === 'root_question';
  const persistedQuestionId = isFreshRootQuestion
    ? await createInterviewQuestion({
      sessionId: session.id,
      questionOrder: result.nextQuestionOrder,
      questionType: result.questionType,
      sourceType: observation.nextQuestion?.sourceType || observation.nextQuestion?.sourceStage || 'prepared_question_pool',
      questionText: result.displayText,
      basedOnCv: Boolean(observation.nextQuestion?.linkedCvEvidence?.length),
      basedOnJd: Boolean(observation.nextQuestion?.linkedJdRequirement?.length),
    })
    : result.rootQuestionId;
  if (isFreshRootQuestion && result.preparedQuestionId) {
    try {
      await markQuestionPoolItemAsked({
        sessionId: session.id,
        questionId: result.preparedQuestionId,
        askedTurnIndex: result.nextQuestionOrder,
        rankTrace: observation.nextQuestion?.rankTrace || {},
      });
    } catch (error) {
      logger.warn('Skipped question next-root asked-state update failed', {
        sessionId: session.id,
        preparedQuestionId: result.preparedQuestionId,
        error: error.message,
      });
    }
  }
  await appendTranscriptTurn(session.id, {
    role: 'ai',
    text: result.displayText,
    timestamp: new Date().toISOString(),
    questionId: persistedQuestionId,
    metadata: {
      turnKind: result.turnKind,
      turnType: result.turnType,
      countsAsQuestion: result.turnKind === 'root_question',
      countsAsAnswer: false,
      parentQuestionId: result.parentQuestionId,
      rootQuestionId: result.rootQuestionId,
      preparedQuestionId: result.preparedQuestionId,
      catalogQuestionId: result.catalogQuestionId,
      ambiguityMode: observation.ambiguityMode || null,
      clarificationContextVersion: observation.clarificationContextVersion || null,
      scopeResponseReason: observation.scopeResponseReason,
      clarificationIntent: observation.intentType || null,
      controllerAction: observation.actionType,
      selectionSource: plan.selectionSource,
      stage: result.stage || null,
      topic: result.topic || null,
      questionCategory: result.questionCategory || null,
      questionDecision: result.questionDecision,
    },
  });
  enqueueBackgroundJob('trace-question-scope-clarification', () => recordAgentTraceEvent({
    sessionId: session.id,
    workflowRunId,
    eventType: 'question_scope_clarification',
    mode: 'voice',
    payload: buildQuestionScopeTracePayload(observation),
  }), { sessionId: session.id, workflowRunId });
  harnessObserver({
    decisionContext: null,
    fallbackPlan: plan,
    plan,
    interviewerOutput: result,
    trajectoryStep: null,
    reflectionRecord: null,
  });
  return result;
};
