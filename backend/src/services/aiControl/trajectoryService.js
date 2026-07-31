import crypto from 'crypto';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { getToolNameForAction } from '../../constants/agentToolNames.js';

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
} = {}) => ({
  trajectoryId: crypto.randomUUID(),
  createdAt: new Date().toISOString(),
  workflowRunId,
  sessionId: session.id,
  section: actorOutput.stage || decisionContext.currentStage || environment?.questionContext?.latestQuestionStage || 'opening',
  sectionKey: decisionContext.sectionState?.sectionKey || null,
  targetTopic: actorOutput.topic || actionInput.targetTopic || decisionContext.currentTopic || environment?.questionContext?.latestQuestionTopic || 'role_fit',
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
});

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
