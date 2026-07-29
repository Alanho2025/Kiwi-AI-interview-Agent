import { enqueueBackgroundJob } from '../../jobs/backgroundJobQueue.js';
import { recordAgentTraceEvent } from '../aiControl/agentTraceService.js';
import { getNextQuestionOrder } from '../interviewStateService.js';
import { appendTranscriptTurn, updateLatestTranscriptTurnMetadata } from '../sessionService.js';
import {
  buildQuestionScopeTracePayload,
  QUESTION_SCOPE_TURN_TYPES,
} from './questionScopeClarificationService.js';

export const buildQuestionScopeRequestMetadata = (observation = {}) => ({
  turnType: QUESTION_SCOPE_TURN_TYPES.REQUEST,
  countsAsQuestion: false,
  countsAsAnswer: false,
  parentQuestionId: observation.parentQuestionId || observation.rootQuestionId || null,
  rootQuestionId: observation.rootQuestionId || null,
  preparedQuestionId: observation.preparedQuestionId || null,
  catalogQuestionId: observation.catalogQuestionId || null,
  ambiguityMode: observation.ambiguityMode || null,
  clarificationContextVersion: observation.clarificationContextVersion || null,
  scopeResponseReason: observation.scopeResponseReason || null,
});

const resolveScenario = (observation = {}) => {
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

export const buildQuestionScopeControllerOutput = ({ session = {}, observation = {} } = {}) => {
  const responseText = String(observation.responseText || '').trim();
  const scenario = resolveScenario(observation);
  const questionDecision = {
    turnKind: 'repair',
    scenario,
    sourcePolicy: observation.clarificationContextVersion
      ? 'versioned_prepared_scope_context'
      : 'deterministic_scope_fallback',
    parentQuestionId: observation.parentQuestionId || observation.rootQuestionId || null,
    rootQuestionId: observation.rootQuestionId || null,
    preparedQuestionId: observation.preparedQuestionId || null,
    catalogQuestionId: observation.catalogQuestionId || null,
    ambiguityMode: observation.ambiguityMode || null,
    clarificationContextVersion: observation.clarificationContextVersion || null,
    scopeResponseReason: observation.scopeResponseReason || null,
  };

  return {
    questionType: 'question_scope_clarification',
    nextQuestion: responseText,
    displayText: responseText,
    interviewerTurn: {
      feedbackMode: 'deterministic_scope_clarification',
      preamble: '',
      question: responseText,
      displayText: responseText,
    },
    rationale: 'Answered a candidate scope question without advancing the active interview question.',
    rationaleSummary: 'Kept the active root question while resolving or bounding its scope.',
    stage: observation.stage || null,
    topic: observation.topic || null,
    questionCategory: observation.questionCategory || null,
    turnKind: 'repair',
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
    questionDecision,
    nextQuestionOrder: resolvePreservedQuestionOrder(session),
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
  await appendTranscriptTurn(session.id, {
    role: 'ai',
    text: result.displayText,
    timestamp: new Date().toISOString(),
    questionId: observation.rootQuestionId,
    metadata: {
      turnKind: 'repair',
      turnType: observation.turnType,
      countsAsQuestion: false,
      countsAsAnswer: false,
      parentQuestionId: observation.parentQuestionId || observation.rootQuestionId,
      rootQuestionId: observation.rootQuestionId,
      preparedQuestionId: observation.preparedQuestionId || null,
      catalogQuestionId: observation.catalogQuestionId || null,
      ambiguityMode: observation.ambiguityMode || null,
      clarificationContextVersion: observation.clarificationContextVersion || null,
      scopeResponseReason: observation.scopeResponseReason,
      controllerAction: observation.actionType,
      selectionSource: plan.selectionSource,
      stage: observation.stage || null,
      topic: observation.topic || null,
      questionCategory: observation.questionCategory || null,
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
