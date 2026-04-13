import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';

const includesAny = (values = [], needles = []) => needles.some((needle) => values.includes(needle));

export const selectNextAction = (decisionContext = {}) => {
  const candidateState = decisionContext.candidateState || {};
  const coverageState = decisionContext.coverageState || {};
  const matchState = decisionContext.matchState || {};
  const currentStage = String(decisionContext.currentStage || '').toLowerCase();
  const targetTopic = coverageState.missingTopics?.[0]
    || matchState.validationTargets?.[0]
    || decisionContext.currentTopic
    || 'role_fit';

  if (decisionContext.taskType === 'generate_report') {
    return {
      selectedAction: AGENT_ACTION_TYPES.GENERATE_REPORT_DRAFT,
      rationale: 'The current task is report generation, so the next action is to build a grounded draft.',
      confidence: 0.9,
      actionInput: { targetTopic: 'report', probeType: null, forceEvidence: true },
    };
  }

  if (currentStage.includes('wrap')) {
    return {
      selectedAction: AGENT_ACTION_TYPES.WRAP_STAGE,
      rationale: 'The interview is already at the wrap stage.',
      confidence: 0.95,
      actionInput: { targetTopic: 'wrap_up', probeType: null, forceEvidence: false },
    };
  }

  if (candidateState.specificityLevel === 'low') {
    return {
      selectedAction: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
      rationale: 'The latest answer was too broad, so a probing question is needed before switching topics.',
      confidence: 0.84,
      actionInput: { targetTopic, probeType: 'specific_example', forceEvidence: true },
    };
  }

  if (matchState.validationTargets?.length) {
    return {
      selectedAction: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      rationale: 'There are unresolved validation targets that should be checked with direct evidence.',
      confidence: 0.82,
      actionInput: { targetTopic: matchState.validationTargets[0], probeType: 'validation', forceEvidence: true },
    };
  }

  if (coverageState.missingTopics?.length) {
    return {
      selectedAction: AGENT_ACTION_TYPES.SWITCH_TOPIC,
      rationale: 'A required topic has not been covered yet, so the controller should switch to it.',
      confidence: 0.8,
      actionInput: { targetTopic: coverageState.missingTopics[0], probeType: 'coverage', forceEvidence: false },
    };
  }

  if (includesAny(coverageState.coveredTopics || [], ['motivation', 'teamwork', 'problem_solving']) && !currentStage.includes('behavioural')) {
    return {
      selectedAction: AGENT_ACTION_TYPES.ASK_RETRIEVED_QUESTION,
      rationale: 'Core topics are covered, so the controller can use retrieved role-specific follow-up questions.',
      confidence: 0.72,
      actionInput: { targetTopic, probeType: 'role_specific', forceEvidence: true },
    };
  }

  return {
    selectedAction: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
    rationale: 'No stronger condition was triggered, so the safest next step is the next planned pool question.',
    confidence: 0.7,
    actionInput: { targetTopic, probeType: null, forceEvidence: false },
  };
};
