import { RETRIEVAL_OBJECTIVES } from '../../constants/retrievalObjectives.js';
import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';

export const buildRetrievalObjective = ({ taskType = '', actionType = '', decisionContext = {}, targetTopic = '' } = {}) => {
  if (taskType === 'generate_report') {
    return {
      objective: RETRIEVAL_OBJECTIVES.COLLECT_REPORT_EVIDENCE,
      targetTopic: targetTopic || 'report',
      evidenceType: 'grounding',
      fallbackPolicy: 'broaden_query_once',
    };
  }

  if (actionType === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION) {
    return {
      objective: RETRIEVAL_OBJECTIVES.VALIDATE_CANDIDATE_CLAIM,
      targetTopic: targetTopic || decisionContext.currentTopic || 'validation',
      evidenceType: 'claim_support',
      fallbackPolicy: 'session_first_then_broaden',
    };
  }

  if (actionType === AGENT_ACTION_TYPES.SWITCH_TOPIC) {
    return {
      objective: RETRIEVAL_OBJECTIVES.COVER_UNASKED_REQUIREMENT,
      targetTopic: targetTopic || decisionContext.currentTopic || 'coverage',
      evidenceType: 'coverage_gap',
      fallbackPolicy: 'use_global_question_bank',
    };
  }

  if (actionType === AGENT_ACTION_TYPES.ASK_RETRIEVED_QUESTION) {
    return {
      objective: RETRIEVAL_OBJECTIVES.FIND_ROLE_SPECIFIC_QUESTION,
      targetTopic: targetTopic || decisionContext.currentTopic || 'role_fit',
      evidenceType: 'question_candidate',
      fallbackPolicy: 'behavioural_backup',
    };
  }

  return {
    objective: RETRIEVAL_OBJECTIVES.BOOTSTRAP_INTERVIEW_CONTEXT,
    targetTopic: targetTopic || decisionContext.currentTopic || 'role_fit',
    evidenceType: 'context',
    fallbackPolicy: 'broaden_query_once',
  };
};
