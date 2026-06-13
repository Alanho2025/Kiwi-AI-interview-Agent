import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { ensureArray, clamp, normalizeKey } from '../../utils/commonHelpers.js';

const includesAny = (values = [], needles = []) => needles.some((needle) => values.includes(needle));
const normalizeFocusAreaKey = (value = 'combined') => String(value || 'combined').trim().toLowerCase().replace('behavioural', 'behavioral');
const clampPriority = (value = 0) => clamp(value, 0, 1);
const normalizedTopic = (value = '') => normalizeKey(value).replace(/[^a-z0-9]+/g, ' ').trim();

const topicsMatch = (source = '', target = '') => {
  const sourceKey = normalizedTopic(source);
  const targetKey = normalizedTopic(target);
  return Boolean(sourceKey && targetKey && (sourceKey.includes(targetKey) || targetKey.includes(sourceKey)));
};

const getSkillDenialState = (evaluatorState = {}) => evaluatorState.skillDenial || evaluatorState.plannerSignals?.skillDenial || {};

const targetWasDenied = (target = '', skillDenialState = {}) => ensureArray(skillDenialState.deniedTargets)
  .some((deniedTarget) => topicsMatch(target, deniedTarget));

const filterDeniedValidationTargets = (validationTargets = [], skillDenialState = {}) => ensureArray(validationTargets)
  .filter((target) => !targetWasDenied(target, skillDenialState));

const resolveTargetTopic = ({
  currentTopic = '',
  dynamicSlotState = {},
  matchState = {},
  coverageState = {},
  abductiveState = {},
  skillDenialState = {},
} = {}) => {
  const candidateTopics = [
    currentTopic,
    dynamicSlotState.activeSlotTopics?.[0],
    matchState.validationTargets?.[0],
    abductiveState.probeTopic,
    coverageState.missingTopics?.[0],
    ensureArray(skillDenialState.alternativeTools)[0],
    'role_fit',
  ];
  const safeTopic = candidateTopics.find((topic) => topic && !targetWasDenied(topic, skillDenialState));
  if (safeTopic) return safeTopic;
  return 'role_fit';
};

const MODEL_SELECTION_BLOCKED_ACTIONS = new Set([
  AGENT_ACTION_TYPES.GENERATE_REPORT_DRAFT,
  AGENT_ACTION_TYPES.WRAP_STAGE,
  AGENT_ACTION_TYPES.ANSWER_CANDIDATE_QUESTION,
  AGENT_ACTION_TYPES.REPHRASE_QUESTION,
  AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION,
  AGENT_ACTION_TYPES.SHIFT_SECTION,
]);

export const buildCandidateAction = (
  action,
  priority = 0.5,
  reason = '',
  evidenceNeed = [],
  risk = 'low',
  actionInput = {},
) => ({
  action,
  priority: clampPriority(priority),
  reason: String(reason || '').trim(),
  evidenceNeed: ensureArray(evidenceNeed).filter(Boolean),
  risk: ['low', 'medium', 'high'].includes(risk) ? risk : 'low',
  actionInput: actionInput || {},
});

export const rankCandidateActions = (candidateActions = []) => ensureArray(candidateActions)
  .filter((item) => item?.action)
  .sort((a, b) => clampPriority(b.priority) - clampPriority(a.priority));

const baseCandidate = (basePlan = {}) => buildCandidateAction(
  basePlan.selectedAction,
  basePlan.confidence || 0.7,
  basePlan.rationale,
  basePlan.actionInput?.forceEvidence ? ['supporting_evidence'] : ['coverage'],
  'low',
  basePlan.actionInput || {},
);

export const withCandidateActions = (basePlan = {}, candidateActions = []) => {
  const ranked = rankCandidateActions(candidateActions.length ? candidateActions : [baseCandidate(basePlan)]);
  const recommendedAction = ranked[0]?.action || basePlan.selectedAction;
  const allowModelSelection = Boolean(
    basePlan.allowModelSelection !== false
    && !MODEL_SELECTION_BLOCKED_ACTIONS.has(basePlan.selectedAction)
    && ranked.length > 1,
  );

  return {
    ...basePlan,
    recommendedAction,
    candidateActions: ranked,
    allowModelSelection,
    selectionSource: basePlan.selectionSource || 'rule_fallback',
  };
};

const withDefaultCandidates = ({ basePlan, targetTopic, coverageState = {}, matchState = {}, evaluatorState = {}, focusAreaKey = 'combined' } = {}) => {
  const candidates = [baseCandidate(basePlan)];
  const currentInput = basePlan.actionInput || {};
  const missingEvidence = ensureArray(evaluatorState.plannerSignals?.missingEvidence || evaluatorState.fastAnswerUnderstanding?.missingEvidence);

  if (
    ![AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION, AGENT_ACTION_TYPES.ASK_PROBING_QUESTION].includes(basePlan.selectedAction)
    && currentInput.forceEvidence
  ) {
    candidates.push(buildCandidateAction(
      AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
      Math.max(0.56, clampPriority(basePlan.confidence || 0.7) - 0.12),
      'A narrower probing question could still collect personal action and result evidence.',
      ['personal_action', 'result'],
      'low',
      { targetTopic, probeType: focusAreaKey === 'behavioral' ? 'behavioural_validation' : 'specific_example', forceEvidence: true },
    ));
  }

  if (basePlan.selectedAction === AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION) {
    candidates.push(buildCandidateAction(
      AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
      0.68,
      'Ownership evidence may still be incomplete, so a specific-example probe is also valid.',
      ['personal_action', ...missingEvidence.slice(0, 2)],
      'low',
      { targetTopic, probeType: focusAreaKey === 'behavioral' ? 'behavioural_validation' : 'specific_example', forceEvidence: true },
    ));
  }

  if (basePlan.selectedAction === AGENT_ACTION_TYPES.ASK_PROBING_QUESTION) {
    candidates.push(buildCandidateAction(
      AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      0.66,
      'The answer may have enough substance to deepen on trade-off, validation, or result.',
      ['tradeoff', 'validation_method', 'result'],
      'low',
      { targetTopic, probeType: 'deepen', forceEvidence: true },
    ));
  }

  if (ensureArray(matchState.validationTargets).length && focusAreaKey !== 'behavioral') {
    candidates.push(buildCandidateAction(
      AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      basePlan.selectedAction === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION ? basePlan.confidence || 0.82 : 0.74,
      'A validation target remains unresolved and should be checked with direct evidence before generic friction probes.',
      ['claim_validation'],
      'medium',
      { targetTopic: matchState.validationTargets[0], probeType: 'validation', forceEvidence: true },
    ));
  }

  if (ensureArray(coverageState.missingTopics).length) {
    candidates.push(buildCandidateAction(
      AGENT_ACTION_TYPES.SWITCH_TOPIC,
      basePlan.selectedAction === AGENT_ACTION_TYPES.SWITCH_TOPIC ? basePlan.confidence || 0.8 : 0.42,
      'A required topic still has a coverage gap, but switching should wait if the current answer has follow-up value.',
      ['coverage'],
      'medium',
      { targetTopic: coverageState.missingTopics[0], probeType: 'coverage', forceEvidence: false, freshOnly: true },
    ));
  }

  return withCandidateActions(basePlan, candidates);
};

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
  const focusAreaKey = normalizeFocusAreaKey(interviewStructure.focusAreaKey || decisionContext.focusArea || 'combined');
  const skillDenialState = getSkillDenialState(evaluatorState);
  const activeMatchState = {
    ...matchState,
    validationTargets: filterDeniedValidationTargets(matchState.validationTargets, skillDenialState),
  };
  const targetTopic = resolveTargetTopic({
    currentTopic: decisionContext.currentTopic || evaluatorState.currentTopic,
    dynamicSlotState,
    matchState: activeMatchState,
    coverageState,
    abductiveState,
    skillDenialState,
  });
  const shouldProbeWeakEvidence = candidateState.specificityLevel === 'low' || evaluatorState.suggestedNextMode === 'probe';
  const finalizePlan = (basePlan, candidateActions = null) => (
    candidateActions
      ? withCandidateActions(basePlan, candidateActions)
      : withDefaultCandidates({ basePlan, targetTopic, coverageState, matchState: activeMatchState, evaluatorState, focusAreaKey })
  );

  if (decisionContext.taskType === 'generate_report') {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.GENERATE_REPORT_DRAFT,
      rationale: 'The current task is report generation, so the next action is to build a grounded draft.',
      confidence: 0.9,
      actionInput: { targetTopic: 'report', probeType: null, forceEvidence: true },
      allowModelSelection: false,
    });
  }

  const isFinalPlannedTurn = Boolean(interviewStructure.isFinalPlannedTurn);
  if (isFinalPlannedTurn && !evaluatorState.misunderstandingFlag) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.WRAP_STAGE,
      rationale: 'The interview is on the final planned turn, so the controller should use a clear closing question instead of opening another chain.',
      confidence: 0.93,
      actionInput: { targetTopic: 'candidate_questions', probeType: 'close_interview', forceEvidence: false },
      allowModelSelection: false,
    });
  }

  const requiresTechnicalRecovery = interviewStructure.focusAreaKey === 'combined'
    && interviewStructure.forceCategory === 'technical'
    && !interviewStructure.mustBeFreshQuestion
    && !evaluatorState.misunderstandingFlag
    && evaluatorState.suggestedNextMode !== 'rephrase';

  if (requiresTechnicalRecovery) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.SHIFT_SECTION,
      rationale: 'The combined interview is behind on technical coverage, so the controller should shift into a technical question instead of extending the current behavioural chain.',
      confidence: 0.89,
      actionInput: { targetTopic: 'technical', probeType: 'technical_recovery', forceEvidence: false, freshOnly: true, category: 'technical' },
      allowModelSelection: false,
    });
  }

  if (interviewStructure.mustBeFreshQuestion) {
    return finalizePlan({
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
    });
  }

  if (evaluatorState.closeCurrentIntent || interviewStructure.currentTopicState?.exhausted) {
    return finalizePlan({
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
    });
  }

  if (currentStage.includes('wrap') && evaluatorState.hasCandidateQuestion) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ANSWER_CANDIDATE_QUESTION,
      rationale: 'The candidate asked a question during the wrap-up stage, so the controller should answer it dynamically.',
      confidence: 0.95,
      actionInput: { targetTopic: 'candidate_questions', probeType: 'answer_question', forceEvidence: false },
      allowModelSelection: false,
    });
  }

  if (currentStage.includes('wrap')) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.WRAP_STAGE,
      rationale: 'The interview is already at the wrap stage.',
      confidence: 0.95,
      actionInput: { targetTopic: 'wrap_up', probeType: null, forceEvidence: false },
      allowModelSelection: false,
    });
  }

  if (evaluatorState.candidateRepetitionComplaint || evaluatorState.plannerSignals?.candidateRepetitionComplaint) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.SWITCH_TOPIC,
      rationale: 'The candidate explicitly signalled that the interviewer repeated the same question, so the controller should acknowledge the concern and move to a fresh topic instead of rephrasing again.',
      confidence: 0.92,
      actionInput: {
        targetTopic: coverageState.missingTopics?.[0] || interviewStructure.forceCategory || 'next_topic',
        probeType: 'repetition_repair_switch',
        forceEvidence: false,
        freshOnly: true,
        category: interviewStructure.forceCategory || null,
      },
      allowModelSelection: false,
    });
  }

  const repairCount = Number(evaluatorState.repairCount || interviewStructure.currentTopicState?.repairCount || 0);
  const repeatedRepairRequested = Boolean(evaluatorState.repeatedRepairRequested || evaluatorState.questionSimilarityFlag) || repairCount >= 2;
  if ((evaluatorState.suggestedNextMode === 'rephrase' || evaluatorState.misunderstandingFlag) && repeatedRepairRequested) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION,
      rationale: 'The candidate has repeatedly signalled misunderstanding, so the controller should reduce cognitive load with a scaffolded step-by-step question.',
      confidence: 0.9,
      actionInput: { targetTopic: evaluatorState.currentTopic || targetTopic, probeType: 'scaffold', forceEvidence: true, scaffoldStep: 'project_first' },
      allowModelSelection: false,
    });
  }

  if (evaluatorState.suggestedNextMode === 'rephrase' || evaluatorState.misunderstandingFlag) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      rationale: 'The evaluator flagged likely misunderstanding, so the safest next step is to rephrase the current topic.',
      confidence: 0.87,
      actionInput: { targetTopic: evaluatorState.currentTopic || targetTopic, probeType: 'rephrase', forceEvidence: true },
      allowModelSelection: false,
    });
  }

  if (activeMatchState.validationTargets?.length && focusAreaKey !== 'behavioral' && !shouldProbeWeakEvidence) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      rationale: 'There are unresolved validation targets and the latest answer has enough substance for direct validation before generic friction or stress probes.',
      confidence: 0.88,
      actionInput: { targetTopic: activeMatchState.validationTargets[0], probeType: 'validation', forceEvidence: true },
    });
  }

  const projectUsage = agentMemory.projectUsage || {};
  const overusedProject = Object.keys(projectUsage).find((project) => projectUsage[project] >= 2);
  if (overusedProject && !evaluatorState.misunderstandingFlag && evaluatorState.suggestedNextMode !== 'rephrase') {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.FORCE_SHIFT_PROJECT,
      rationale: `The candidate has mentioned "${overusedProject}" ${projectUsage[overusedProject]} times. To ensure CV breadth, the controller must force a shift to a different project or company.`,
      confidence: 0.91,
      actionInput: { targetTopic, probeType: 'shift_context', forbiddenProject: overusedProject, forceEvidence: true },
    });
  }

  const isTooPerfect = evaluatorState.successStatus === 'usable'
    && evaluatorState.evidenceGainScore >= 0.65
    && (evaluatorState.frictionState?.frictionLevel === 'low' || !evaluatorState.frictionState?.frictionDetected);

  if (isTooPerfect && !isFinalPlannedTurn) {
    const useFriction = focusAreaKey === 'behavioral' || Math.random() > 0.5;
    return finalizePlan({
      selectedAction: useFriction ? AGENT_ACTION_TYPES.PROBE_FRICTION : AGENT_ACTION_TYPES.PROBE_STRESS,
      rationale: isTooPerfect ? 'The answer was very smooth but lacked real-world friction/stress. Probing boundaries now.' : 'Deepening the conversation.',
      confidence: 0.88,
      actionInput: { targetTopic, probeType: useFriction ? 'failure_analysis' : 'constraint_test', forceEvidence: true },
    }, [
      buildCandidateAction(useFriction ? AGENT_ACTION_TYPES.PROBE_FRICTION : AGENT_ACTION_TYPES.PROBE_STRESS, 0.88, 'The answer was smooth but needs friction or stress evidence.', ['friction', 'constraints'], 'low', { targetTopic, probeType: useFriction ? 'failure_analysis' : 'constraint_test', forceEvidence: true }),
      buildCandidateAction(AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION, 0.64, 'A deep dive can still test decision quality without forcing a stress scenario.', ['decision_quality', 'validation_method'], 'low', { targetTopic, probeType: 'deepen', forceEvidence: true }),
    ]);
  }

  if (abductiveState.shouldProbe) {
    if (focusAreaKey === 'behavioral') {
      return finalizePlan({
        selectedAction: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
        rationale: `A hidden gap was inferred (${abductiveState.hiddenGap}), but the selected mode is behavioural, so the controller should probe it through STAR-style behaviour rather than technical diagnosis.`,
        confidence: 0.84,
        actionInput: { targetTopic: abductiveState.probeTopic || targetTopic, probeType: 'behavioural_abductive_probe', forceEvidence: true },
      });
    }
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION,
      rationale: `A hidden gap was inferred (${abductiveState.hiddenGap}), so the controller should probe it directly before moving on.`,
      confidence: 0.84,
      actionInput: { targetTopic: abductiveState.probeTopic || targetTopic, probeType: 'abductive_probe', forceEvidence: true },
    });
  }

  if (evaluatorState.suggestedNextMode === 'deepen') {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      rationale: 'The answer was usable but still partial, so a deeper follow-up should gather stronger evidence on the same topic.',
      confidence: 0.82,
      actionInput: { targetTopic, probeType: 'deepen', forceEvidence: true },
    });
  }

  if (sectionState.isSectionComplete
    && sectionState.nextSectionKey
    && sectionState.nextSectionKey !== sectionState.sectionKey
    && evaluatorState.suggestedNextMode === 'advance') {
    if (focusAreaKey === 'behavioral' && String(sectionState.nextSectionKey).toLowerCase() === 'technical') {
      return finalizePlan({
        selectedAction: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
        rationale: 'The evaluator suggested a section shift, but behavioural mode blocks technical section transitions. The controller should select a fresh behavioural question instead.',
        confidence: 0.86,
        actionInput: { targetTopic: 'behavioural', probeType: 'mode_locked_fresh_anchor', forceEvidence: false, freshOnly: true, category: 'behavioural' },
        allowModelSelection: false,
      });
    }
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.SHIFT_SECTION,
      rationale: `The current section ${sectionState.sectionKey} is sufficiently covered, and the evaluator signalled advance, so the controller should shift to ${sectionState.nextSectionKey}.`,
      confidence: 0.85,
      actionInput: { targetTopic: sectionState.nextSectionKey, probeType: 'section_shift', forceEvidence: false },
      allowModelSelection: false,
    });
  }

  if (shouldProbeWeakEvidence
    && (Number(interviewStructure.currentTopicState?.followUpCount || 0) >= 2 || evaluatorState.lowEvidenceRepeated)) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION,
      rationale: 'Repeated probing on the same topic has not produced evidence, so the controller should ask a smaller scaffold question before moving on.',
      confidence: 0.86,
      actionInput: { targetTopic, probeType: 'scaffold', forceEvidence: true, scaffoldStep: 'one_concrete_project' },
      allowModelSelection: false,
    });
  }

  if (shouldProbeWeakEvidence) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
      rationale: 'The latest answer was too broad, so a probing question is needed before switching topics or validating a claim.',
      confidence: 0.84,
      actionInput: { targetTopic, probeType: 'specific_example', forceEvidence: true },
    });
  }

  if (sectionState.isSectionComplete && sectionState.nextSectionKey && sectionState.nextSectionKey !== sectionState.sectionKey) {
    if (focusAreaKey === 'behavioral' && String(sectionState.nextSectionKey).toLowerCase() === 'technical') {
      return finalizePlan({
        selectedAction: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
        rationale: 'The current section is covered, but behavioural mode blocks technical section transitions. The controller should stay in behavioural coverage.',
        confidence: 0.84,
        actionInput: { targetTopic: 'behavioural', probeType: 'mode_locked_fresh_anchor', forceEvidence: false, freshOnly: true, category: 'behavioural' },
        allowModelSelection: false,
      });
    }
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.SHIFT_SECTION,
      rationale: `The current section ${sectionState.sectionKey} is sufficiently covered, so the controller should shift to ${sectionState.nextSectionKey}.`,
      confidence: 0.83,
      actionInput: { targetTopic: sectionState.nextSectionKey, probeType: 'section_shift', forceEvidence: false },
      allowModelSelection: false,
    });
  }

  if (activeMatchState.validationTargets?.length) {
    if (focusAreaKey === 'behavioral') {
      return finalizePlan({
        selectedAction: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
        rationale: 'There are validation targets, but behavioural mode requires evidence through behaviour, action, and result instead of technical validation.',
        confidence: 0.82,
        actionInput: { targetTopic: activeMatchState.validationTargets[0], probeType: 'behavioural_validation', forceEvidence: true },
      });
    }
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      rationale: 'There are unresolved validation targets that should be checked with direct evidence.',
      confidence: 0.82,
      actionInput: { targetTopic: activeMatchState.validationTargets[0], probeType: 'validation', forceEvidence: true },
    });
  }

  if (coverageState.missingTopics?.length) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.SWITCH_TOPIC,
      rationale: 'A required topic has not been covered yet, so the controller should switch to it.',
      confidence: 0.8,
      actionInput: { targetTopic: coverageState.missingTopics[0], probeType: 'coverage', forceEvidence: false, freshOnly: true, category: interviewStructure.forceCategory || null },
    });
  }

  if (includesAny(coverageState.coveredTopics || [], ['motivation', 'teamwork', 'problem_solving']) && !currentStage.includes('behavioural')) {
    return finalizePlan({
      selectedAction: AGENT_ACTION_TYPES.ASK_RETRIEVED_QUESTION,
      rationale: 'Core topics are covered, so the controller can use retrieved role-specific follow-up questions.',
      confidence: 0.72,
      actionInput: { targetTopic, probeType: 'role_specific', forceEvidence: true },
    });
  }

  return finalizePlan({
    selectedAction: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
    rationale: 'No stronger condition was triggered, so the safest next step is the next planned pool question.',
    confidence: 0.7,
    actionInput: { targetTopic, probeType: null, forceEvidence: false, freshOnly: false, category: interviewStructure.forceCategory || null },
  });
};
