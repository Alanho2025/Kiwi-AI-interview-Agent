import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';

export const executeInterviewAction = async ({
  selectedAction,
  decisionContext,
  actionInput = {},
  agentRegistry,
  session,
} = {}) => {
  let retrievalBundle = decisionContext?.retrievalState?.latestSources?.length ? null : null;

  if ([AGENT_ACTION_TYPES.ASK_RETRIEVED_QUESTION, AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION].includes(selectedAction)) {
    retrievalBundle = await agentRegistry.retrieval({
      query: `${session.targetRole || ''} ${actionInput.targetTopic || ''} ${actionInput.probeType || ''}`.trim(),
      sessionId: session.id,
      sourceTypes: ['question_bank', 'behavioural_bank', 'interview_plan', 'jd_rubric', 'cv_profile', 'transcript'],
      topK: 5,
      objective: selectedAction,
      targetTopic: actionInput.targetTopic,
    });
  }

  return agentRegistry.interviewer({
    session,
    actionType: selectedAction,
    decisionContext,
    evidenceBundle: decisionContext?.evidenceBundle,
    retrievalBundle: retrievalBundle || null,
    targetTopic: actionInput.targetTopic,
    probeType: actionInput.probeType,
  });
};
