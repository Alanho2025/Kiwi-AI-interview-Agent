import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';

const includesAny = (values = [], needles = []) => needles.some((needle) => values.includes(needle));

export const selectNextAction = (decisionContext = {}) => {
  const candidateState = decisionContext.candidateState || {};
  const coverageState = decisionContext.coverageState || {};
  const matchState = decisionContext.matchState || {};
  const evaluatorState = decisionContext.evaluatorState || {};
  const dynamicSlotState = decisionContext.dynamicSlotState || {};
  const abductiveState = decisionContext.abductiveState || {};
  const sectionState = decisionContext.sectionState || {};
  const interviewStructure = decisionContext.interviewStructure || {};
  const agentMemory = decisionContext.agentMemory || {};
  const currentStage = String(decisionContext.currentStage || '').toLowerCase();
  const targetTopic = decisionContext.currentTopic
    || evaluatorState.currentTopic
    || dynamicSlotState.activeSlotTopics?.[0]
    || matchState.validationTargets?.[0]
    || abductiveState.probeTopic
    || coverageState.missingTopics?.[0]
    || 'role_fit';

  if (decisionContext.taskType === 'generate_report') {
    return {
      selectedAction: AGENT_ACTION_TYPES.GENERATE_REPORT_DRAFT,
      rationale: 'The current task is report generation, so the next action is to build a grounded draft.',
      confidence: 0.9,
      actionInput: { targetTopic: 'report', probeType: null, forceEvidence: true },
    };
  }


  const isFinalPlannedTurn = Boolean(interviewStructure.isFinalPlannedTurn);
  if (isFinalPlannedTurn && !evaluatorState.misunderstandingFlag) {
    return {
      selectedAction: AGENT_ACTION_TYPES.WRAP_STAGE,
      rationale: 'The interview is on the final planned turn, so the controller should use a clear closing question instead of opening another chain.',
      confidence: 0.93,
      actionInput: { targetTopic: 'candidate_questions', probeType: 'close_interview', forceEvidence: false },
    };
  }

  const requiresTechnicalRecovery = interviewStructure.focusAreaKey === 'combined'
    && interviewStructure.forceCategory === 'technical'
    && !interviewStructure.mustBeFreshQuestion
    && !evaluatorState.misunderstandingFlag
    && evaluatorState.suggestedNextMode !== 'rephrase';

  if (requiresTechnicalRecovery) {
    return {
      selectedAction: AGENT_ACTION_TYPES.SHIFT_SECTION,
      rationale: 'The combined interview is behind on technical coverage, so the controller should shift into a technical question instead of extending the current behavioural chain.',
      confidence: 0.89,
      actionInput: { targetTopic: 'technical', probeType: 'technical_recovery', forceEvidence: false, freshOnly: true, category: 'technical' },
    };
  }

  if (interviewStructure.mustBeFreshQuestion) {
    return {
      selectedAction: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
      rationale: `Turn ${interviewStructure.nextTurnIndex} is a fresh-question anchor, so the controller must open a new topic instead of extending the previous chain.`,
      confidence: 0.92,
      actionInput: {
        targetTopic: interviewStructure.requiredCategory || interviewStructure.forceCategory || targetTopic,
        probeType: 'fresh_anchor',
        forceEvidence: false,
        freshOnly: true,
        category: interviewStructure.requiredCategory || interviewStructure.forceCategory || null,
      },
    };
  }

  if (evaluatorState.closeCurrentIntent || interviewStructure.currentTopicState?.exhausted) {
    return {
      selectedAction: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
      rationale: 'The current topic is already sufficiently covered or has reached the follow-up limit, so the controller should move to the next fresh question.',
      confidence: 0.9,
      actionInput: {
        targetTopic: interviewStructure.forceCategory || coverageState.missingTopics?.[0] || targetTopic,
        probeType: 'close_topic',
        forceEvidence: false,
        freshOnly: true,
        category: interviewStructure.forceCategory || null,
      },
    };
  }

  if (currentStage.includes('wrap') && evaluatorState.hasCandidateQuestion) {
    return {
      selectedAction: AGENT_ACTION_TYPES.ANSWER_CANDIDATE_QUESTION,
      rationale: 'The candidate asked a question during the wrap-up stage, so the controller should answer it dynamically.',
      confidence: 0.95,
      actionInput: { targetTopic: 'candidate_questions', probeType: 'answer_question', forceEvidence: false },
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

  if (evaluatorState.suggestedNextMode === 'rephrase' || evaluatorState.misunderstandingFlag) {
    return {
      selectedAction: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      rationale: 'The evaluator flagged likely misunderstanding, so the safest next step is to rephrase the current topic.',
      confidence: 0.87,
      actionInput: { targetTopic: evaluatorState.currentTopic || targetTopic, probeType: 'rephrase', forceEvidence: true },
    };
  }

  // --- STRATEGIC INTENTS ---
  const projectUsage = agentMemory.projectUsage || {};
  const overusedProject = Object.keys(projectUsage).find((project) => projectUsage[project] >= 2);
  if (overusedProject && !evaluatorState.misunderstandingFlag && evaluatorState.suggestedNextMode !== 'rephrase') {
    return {
      selectedAction: AGENT_ACTION_TYPES.FORCE_SHIFT_PROJECT,
      rationale: `The candidate has mentioned "${overusedProject}" ${projectUsage[overusedProject]} times. To ensure CV breadth, the controller must force a shift to a different project or company.`,
      confidence: 0.91,
      actionInput: { targetTopic, probeType: 'shift_context', forbiddenProject: overusedProject, forceEvidence: true },
    };
  }

  const isTooPerfect = evaluatorState.successStatus === 'usable'
    && evaluatorState.evidenceGainScore >= 0.65
    && (evaluatorState.frictionState?.frictionLevel === 'low' || !evaluatorState.frictionState?.frictionDetected);

  if (isTooPerfect && !isFinalPlannedTurn) {
    // If the answer is strong but "happy path", introduce stress or look for friction
    const useFriction = Math.random() > 0.5;
    return {
      selectedAction: useFriction ? AGENT_ACTION_TYPES.PROBE_FRICTION : AGENT_ACTION_TYPES.PROBE_STRESS,
      rationale: isTooPerfect ? 'The answer was very smooth but lacked real-world friction/stress. Probing boundaries now.' : 'Deepening the conversation.',
      confidence: 0.88,
      actionInput: { targetTopic, probeType: useFriction ? 'failure_analysis' : 'constraint_test', forceEvidence: true },
    };
  }
  // -------------------------

  if (abductiveState.shouldProbe) {
    return {
      selectedAction: AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION,
      rationale: `A hidden gap was inferred (${abductiveState.hiddenGap}), so the controller should probe it directly before moving on.`,
      confidence: 0.84,
      actionInput: { targetTopic: abductiveState.probeTopic || targetTopic, probeType: 'abductive_probe', forceEvidence: true },
    };
  }

  if (evaluatorState.suggestedNextMode === 'deepen') {
    return {
      selectedAction: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      rationale: 'The answer was usable but still partial, so a deeper follow-up should gather stronger evidence on the same topic.',
      confidence: 0.82,
      actionInput: { targetTopic, probeType: 'deepen', forceEvidence: true },
    };
  }

  if (sectionState.isSectionComplete
    && sectionState.nextSectionKey
    && sectionState.nextSectionKey !== sectionState.sectionKey
    && evaluatorState.suggestedNextMode === 'advance') {
    return {
      selectedAction: AGENT_ACTION_TYPES.SHIFT_SECTION,
      rationale: `The current section ${sectionState.sectionKey} is sufficiently covered, and the evaluator signalled advance, so the controller should shift to ${sectionState.nextSectionKey}.`,
      confidence: 0.85,
      actionInput: { targetTopic: sectionState.nextSectionKey, probeType: 'section_shift', forceEvidence: false },
    };
  }

  if (candidateState.specificityLevel === 'low' || evaluatorState.suggestedNextMode === 'probe') {
    return {
      selectedAction: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
      rationale: 'The latest answer was too broad, so a probing question is needed before switching topics.',
      confidence: 0.84,
      actionInput: { targetTopic, probeType: 'specific_example', forceEvidence: true },
    };
  }

  if (sectionState.isSectionComplete && sectionState.nextSectionKey && sectionState.nextSectionKey !== sectionState.sectionKey) {
    return {
      selectedAction: AGENT_ACTION_TYPES.SHIFT_SECTION,
      rationale: `The current section ${sectionState.sectionKey} is sufficiently covered, so the controller should shift to ${sectionState.nextSectionKey}.`,
      confidence: 0.83,
      actionInput: { targetTopic: sectionState.nextSectionKey, probeType: 'section_shift', forceEvidence: false },
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
      actionInput: { targetTopic: coverageState.missingTopics[0], probeType: 'coverage', forceEvidence: false, freshOnly: true, category: interviewStructure.forceCategory || null },
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
    actionInput: { targetTopic, probeType: null, forceEvidence: false, freshOnly: false, category: interviewStructure.forceCategory || null },
  };
};
