import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { getToolNameForAction } from '../../constants/agentToolNames.js';

export const executeInterviewAction = async ({
  selectedAction,
  decisionContext,
  actionInput = {},
  agentRegistry,
  session,
  onSentence = null,
} = {}) => {
  let retrievalBundle = decisionContext?.retrievalState?.latestSources?.length ? null : null;

  if ([AGENT_ACTION_TYPES.ASK_RETRIEVED_QUESTION, AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION].includes(selectedAction)) {
    retrievalBundle = await agentRegistry.retrieval({
      query: `${session.targetRole || ''} ${actionInput.targetTopic || ''} ${actionInput.probeType || ''}`.trim(),
      sessionId: session.id,
      sourceTypes: ['question_bank', 'behavioural_bank', 'interview_plan', 'prepared_question_pool', 'jd_rubric', 'cv_profile', 'transcript'],
      topK: 5,
      objective: selectedAction,
      targetTopic: actionInput.targetTopic,
    });
  }

  const result = await agentRegistry.interviewer({
    session,
    actionType: selectedAction,
    decisionContext,
    evidenceBundle: decisionContext?.evidenceBundle,
    retrievalBundle: retrievalBundle || null,
    targetTopic: actionInput.targetTopic,
    probeType: actionInput.probeType,
    freshOnly: Boolean(actionInput.freshOnly),
    category: actionInput.category || null,
    onSentence,
  });

  return {
    ...result,
    reactTrace: {
      ...(result?.reactTrace || {}),
      tool: getToolNameForAction(selectedAction),
    },
  };
};
