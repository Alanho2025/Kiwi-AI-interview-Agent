import crypto from 'crypto';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { getToolNameForAction } from '../../constants/agentToolNames.js';

const resolveAnsweredQuestionFamily = (metadata = {}) => {
  if (metadata.questionFamily) return metadata.questionFamily;
  const category = String(metadata.questionCategory || metadata.category || metadata.stage || '').toLowerCase();
  if (category.includes('opening') || metadata.questionType === 'self_intro') return 'self_intro';
  if (category.includes('behavio')) return 'behavioural';
  if (category.includes('motivation')) return 'motivation';
  return 'role_specific';
};

const buildAnsweredQuestionReference = (session = {}) => {
  const latestQuestion = [...(session.transcript || [])].reverse().find((turn) => (
    turn?.role === 'ai' && turn?.metadata?.countsAsQuestion !== false
  ));
  if (!latestQuestion) return null;
  const metadata = latestQuestion.metadata || {};
  return {
    questionId: latestQuestion.questionId || metadata.questionId || null,
    preparedQuestionId: metadata.preparedQuestionId || metadata.questionDecision?.preparedQuestionId || null,
    topic: metadata.topic || 'role_fit',
    questionFamily: resolveAnsweredQuestionFamily(metadata),
  };
};

export const buildTrajectoryStep = ({
  workflowRunId = null,
  session = {},
  environment = {},
  decisionContext = {},
  selectedAction = '',
  actionInput = {},
  plan = {},
  actorOutput = {},
  evaluatorOutput = null,
} = {}) => {
  const answeredQuestion = buildAnsweredQuestionReference(session);
  return {
    trajectoryId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    workflowRunId,
    sessionId: session.id,
    section: answeredQuestion?.questionFamily || decisionContext.currentStage || environment?.questionContext?.latestQuestionStage || 'opening',
    sectionKey: decisionContext.sectionState?.sectionKey || null,
    targetTopic: answeredQuestion?.topic || decisionContext.currentTopic || environment?.questionContext?.latestQuestionTopic || actorOutput.topic || actionInput.targetTopic || 'role_fit',
    answeredQuestion,
    targetSlots: decisionContext?.coverageState?.missingTopics?.slice(0, 3) || [],
    latestQuestion: environment?.questionContext?.latestQuestionText || null,
    latestAnswer: environment?.latestAnswer?.text || '',
    thoughtSummary: actorOutput.reactTrace?.thoughtSummary || null,
    tool: actorOutput.reactTrace?.tool || getToolNameForAction(actorOutput.reactTrace?.actionName || selectedAction),
    chosenAction: actorOutput.reactTrace?.actionName || selectedAction,
    selectedAction,
    fallbackAction: plan.fallbackAction || plan.recommendedAction || selectedAction,
    selectionSource: plan.selectionSource || 'rule_fallback',
    candidateActions: plan.candidateActions || [],
    plannerSignals: decisionContext?.plannerSignals || evaluatorOutput?.plannerSignals || {},
    starScores: evaluatorOutput?.starBreakdown?.scores || decisionContext?.plannerSignals?.starScores || {},
    actionInput,
    generatedQuestion: actorOutput.nextQuestion || null,
    observationSummary: actorOutput.reactTrace?.observationSummary || null,
    slotSignals: {
      missingTopics: decisionContext?.coverageState?.missingTopics || [],
      validationTargets: decisionContext?.matchState?.validationTargets || [],
    },
    dynamicSlots: decisionContext?.dynamicSlotState || null,
    abductiveState: decisionContext?.abductiveState || null,
    sectionState: decisionContext?.sectionState || null,
    evaluator: evaluatorOutput || null,
    isComplete: Boolean(actorOutput.isComplete),
  };
};

export const persistTrajectoryStep = async ({ sessionId, step = {} } = {}) => {
  if (!sessionId) return null;
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $push: { trajectoryRecords: step },
      $set: { latestTrajectoryRecord: step },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return step;
};
