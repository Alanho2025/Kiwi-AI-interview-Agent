/**
 * File responsibility: Convert Kiwi question-agent scenarios to Google Agents CLI traces.
 * Main responsibilities:
 * - Represent evaluator, controller, prepared-pool ranking, turn planning, and question decision metadata.
 * - Score question-selection behavior without leaking evaluator labels into agent_data.
 * - Produce complete EvaluationDataset JSON for agents-cli eval grade.
 */

import { AGENT_ACTION_TYPES } from '../../src/constants/agentActionTypes.js';
import { buildQuestionDecisionTrace } from '../../src/services/aiControl/questionRanker.js';
import { selectNextAction } from '../../src/services/aiControl/actionPlanner.js';
import { deriveAbductiveState } from '../../src/services/aiControl/abductiveReasoningService.js';
import { deriveDynamicSlots } from '../../src/services/aiControl/dynamicSlotService.js';
import { evaluateInterviewTurn } from '../../src/services/aiControl/interviewEvaluatorService.js';
import { buildInterviewEnvironment } from '../../src/services/aiControl/interviewEnvironmentService.js';
import { buildSectionState, inferInterviewSection } from '../../src/services/aiControl/sectionPlannerService.js';
import { buildInterviewTurnPlan } from '../../src/services/questions/interviewTurnOrchestratorService.js';
import { rankPreparedQuestionPool } from '../../src/services/questions/questionPoolRankerService.js';
import { judgeQuestionQuality } from '../helpers/questionQualityJudge.js';
import {
  ensureArray,
  scoreChecks,
  textEvent,
  toTextPart,
  toolCallEvent,
  toolResponseEvent,
  truncate,
} from './traceEventBuilders.js';

const QUESTION_AGENT_ID = 'kiwi_question_agent';
const EVALUATOR_ID = 'interview_evaluator';
const ACTION_PLANNER_ID = 'adaptive_action_planner';
const POOL_RANKER_ID = 'prepared_question_pool_ranker';
const TURN_ORCHESTRATOR_ID = 'interview_turn_orchestrator';
const QUESTION_DECISION_ID = 'question_decision_tracer';

const sharedPoolItems = [
  {
    questionId: 'prepared-db-validation',
    status: 'active',
    questionRole: 'root_question',
    topic: 'database',
    category: 'technical',
    sourceType: 'match_gap',
    sourceStage: 'match_gap',
    text: 'Tell me about one database task you handled yourself.',
    fallbackText: 'Tell me about one database task you handled yourself.',
    priorityWeight: 0.84,
    coverageWeight: 0.9,
    riskWeight: 0.9,
    modeCompatibility: { technical: true, behavioural: false, combined: true },
    evidenceNeed: ['ownership', 'validation_method'],
  },
  {
    questionId: 'prepared-teamwork',
    status: 'active',
    questionRole: 'root_question',
    topic: 'teamwork',
    category: 'behavioural',
    sourceType: 'culture_fit',
    sourceStage: 'common_template',
    text: 'Tell me about a teamwork challenge and what you personally did.',
    fallbackText: 'Tell me about a teamwork challenge and what you personally did.',
    priorityWeight: 0.76,
    coverageWeight: 0.65,
    riskWeight: 0.45,
    modeCompatibility: { technical: false, behavioural: true, combined: true },
    evidenceNeed: ['personal_action', 'result_or_impact'],
  },
  {
    questionId: 'prepared-api-security',
    status: 'active',
    questionRole: 'root_question',
    topic: 'api_security',
    category: 'technical',
    sourceType: 'jd_requirement',
    sourceStage: 'match_validation',
    text: 'Tell me about API security in one project.',
    fallbackText: 'Tell me about API security in one project.',
    priorityWeight: 0.8,
    coverageWeight: 0.82,
    riskWeight: 0.72,
    modeCompatibility: { technical: true, behavioural: false, combined: true },
    evidenceNeed: ['direct_evidence', 'tradeoff', 'validation_method'],
  },
];

const QUESTION_SCENARIOS = [
  {
    id: 'question_misunderstanding_rephrase',
    prompt: 'The candidate says they do not understand the system design question.',
    focusArea: 'combined',
    session: {
      id: 'question-eval-1',
      userId: 'user-1',
      targetRole: 'Backend Developer',
      currentQuestionIndex: 2,
      totalQuestions: 6,
      settings: { focusArea: 'combined' },
      transcript: [
        { role: 'ai', text: 'How do you approach system design?', metadata: { stage: 'technical_core', topic: 'system_design' } },
        { role: 'user', text: 'Sorry, I am not sure what you mean by that.' },
      ],
      analysisResult: {
        explanation: { strengths: ['Node.js'], gaps: ['System design depth'] },
        matchingDetails: { questionPlanHints: { priorityTopics: ['system_design', 'api_security'] }, validationTargets: [] },
        parsedCvProfile: { skills: ['Node.js'], projects: ['API Platform'] },
        parsedJdProfile: { requiredSkills: ['System Design'] },
      },
      interviewPlan: { questionPool: sharedPoolItems },
    },
    poolItems: sharedPoolItems,
    contract: {
      selectedAction: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      suggestedNextMode: 'rephrase',
      turnKind: 'repair',
      scenario: 'rephrase',
    },
  },
  {
    id: 'question_validation_uses_prepared_match_gap',
    prompt: 'The candidate mentions databases and the match gap still needs validation.',
    focusArea: 'technical',
    session: {
      id: 'question-eval-2',
      userId: 'user-2',
      targetRole: 'Backend Developer',
      currentQuestionIndex: 3,
      totalQuestions: 8,
      settings: { focusArea: 'technical' },
      transcript: [
        { role: 'ai', text: 'Tell me about a backend project.', metadata: { stage: 'technical', topic: 'backend_project' } },
        { role: 'user', text: 'I used MongoDB and PostgreSQL for different data needs and can explain the trade-offs.' },
      ],
      analysisResult: {
        explanation: { strengths: ['Node.js'], gaps: ['Database validation depth'] },
        matchingDetails: { questionPlanHints: { priorityTopics: ['database'] }, validationTargets: ['database'] },
        parsedCvProfile: { skills: ['Node.js', 'MongoDB', 'PostgreSQL'], projects: ['Interview Agent'] },
        parsedJdProfile: { requiredSkills: ['Database design'] },
      },
      interviewPlan: { questionPool: sharedPoolItems },
    },
    poolItems: sharedPoolItems,
    forcedAction: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
    contract: {
      selectedAction: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      turnKind: 'root_question',
      selectedPreparedQuestionId: 'prepared-db-validation',
      selectionSource: 'prepared_question_pool',
    },
  },
  {
    id: 'question_followup_does_not_consume_prepared_root',
    prompt: 'A shallow project answer should produce a follow-up without consuming a prepared root question.',
    focusArea: 'technical',
    session: {
      id: 'question-eval-3',
      userId: 'user-3',
      targetRole: 'Frontend Developer',
      currentQuestionIndex: 2,
      totalQuestions: 8,
      settings: { focusArea: 'technical' },
      transcript: [
        {
          role: 'ai',
          questionId: 'parent-question',
          text: 'Please introduce yourself.',
          metadata: {
            stage: 'opening',
            topic: 'self_intro',
            followUpDepth: 0,
            questionDecision: { preparedQuestionId: 'prepared-api-security' },
          },
        },
        { role: 'user', text: 'I used React in the Forkcast project, mostly for the UI.' },
      ],
      analysisResult: {
        parsedCvProfile: {
          skills: ['React'],
          projects: ['Forkcast'],
          evidenceProfile: { sections: { projects: [{ title: 'Forkcast', skills: ['React'] }] } },
        },
        parsedJdProfile: { requiredSkills: ['React'] },
        matchingDetails: { questionPlanHints: { priorityTopics: ['React'] }, validationTargets: ['React'] },
      },
      interviewPlan: { questionPool: sharedPoolItems },
    },
    poolItems: sharedPoolItems,
    forcedAction: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
    contract: {
      selectedAction: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      turnKind: 'follow_up',
      sourcePolicy: 'follow_up_from_parent_no_prepared_root_consumption',
      preparedQuestionConsumed: false,
    },
  },
  {
    id: 'question_technical_mode_blocks_behavioural_pool',
    prompt: 'Technical mode should avoid behavioural prepared questions even when they have reasonable priority.',
    focusArea: 'technical',
    session: {
      id: 'question-eval-4',
      userId: 'user-4',
      targetRole: 'Backend Developer',
      currentQuestionIndex: 4,
      totalQuestions: 8,
      settings: { focusArea: 'technical' },
      transcript: [
        { role: 'ai', text: 'Tell me about API security.', metadata: { stage: 'technical', topic: 'api_security' } },
        { role: 'user', text: 'I implemented JWT auth and rate limiting for our Node API.' },
      ],
      analysisResult: {
        parsedCvProfile: { skills: ['Node.js', 'JWT'], projects: ['Food Recommendation API'] },
        parsedJdProfile: { requiredSkills: ['API Security'] },
        matchingDetails: { questionPlanHints: { priorityTopics: ['api_security', 'teamwork'] }, validationTargets: ['api_security'] },
      },
      interviewPlan: { questionPool: sharedPoolItems },
    },
    poolItems: sharedPoolItems,
    forcedAction: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
    contract: {
      selectedAction: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
      selectedCategory: 'technical',
      modeBoundaryHeld: true,
    },
  },
  {
    id: 'question_section_shift_after_coverage',
    prompt: 'The answer has enough ownership evidence and the section should shift.',
    focusArea: 'combined',
    session: {
      id: 'question-eval-5',
      userId: 'user-5',
      targetRole: 'Backend Developer',
      currentQuestionIndex: 4,
      totalQuestions: 6,
      settings: { focusArea: 'combined' },
      transcript: [
        { role: 'ai', text: 'Tell me about a project you owned.', metadata: { stage: 'experience', topic: 'project' } },
        { role: 'ai', text: 'What result did it lead to?', metadata: { stage: 'experience', topic: 'ownership' } },
        { role: 'user', text: 'I led the backend API redesign and reduced latency by 30 percent.' },
      ],
      analysisResult: {
        explanation: { strengths: ['Ownership'], gaps: ['Behavioural depth'] },
        matchingDetails: { questionPlanHints: { priorityTopics: ['teamwork', 'problem_solving'] }, validationTargets: [] },
        parsedCvProfile: { skills: ['Node.js'], projects: ['Platform API'] },
        parsedJdProfile: { requiredSkills: ['Teamwork'] },
      },
      interviewPlan: { questionPool: sharedPoolItems },
    },
    poolItems: sharedPoolItems,
    contract: {
      selectedAction: AGENT_ACTION_TYPES.SHIFT_SECTION,
      suggestedNextMode: 'advance',
    },
  },
];

const buildAgents = () => ({
  [QUESTION_AGENT_ID]: {
    agent_id: QUESTION_AGENT_ID,
    agent_type: 'QuestionAgentOrchestrator',
    instruction: 'Coordinate answer evaluation, adaptive action selection, prepared question ranking, and transparent question-decision metadata.',
  },
  [EVALUATOR_ID]: {
    agent_id: EVALUATOR_ID,
    agent_type: 'InterviewEvaluator',
    instruction: 'Evaluate the latest candidate answer for misunderstanding, evidence gain, specificity, and recommended next mode.',
  },
  [ACTION_PLANNER_ID]: {
    agent_id: ACTION_PLANNER_ID,
    agent_type: 'AdaptiveActionPlanner',
    instruction: 'Select the next interview action from deterministic controller state and bounded candidate actions.',
  },
  [POOL_RANKER_ID]: {
    agent_id: POOL_RANKER_ID,
    agent_type: 'PreparedQuestionPoolRanker',
    instruction: 'Rank prepared root questions by mode fit, missing evidence, validation targets, freshness, and penalties.',
  },
  [TURN_ORCHESTRATOR_ID]: {
    agent_id: TURN_ORCHESTRATOR_ID,
    agent_type: 'InterviewTurnOrchestrator',
    instruction: 'Classify root, follow-up, and repair turns while preserving parent/root prepared-question linkage.',
  },
  [QUESTION_DECISION_ID]: {
    agent_id: QUESTION_DECISION_ID,
    agent_type: 'QuestionDecisionTraceBuilder',
    instruction: 'Record why a question was selected, what evidence supported it, ranking alternatives, and spoken text.',
  },
});

const latestAiTurn = (session = {}) => [...ensureArray(session.transcript)].reverse().find((turn) => turn.role === 'ai') || null;

const latestUserAnswer = (session = {}) => [...ensureArray(session.transcript)].reverse().find((turn) => turn.role === 'user')?.text || '';

const buildCoverageState = (session = {}) => {
  const aiTurns = ensureArray(session.transcript).filter((turn) => turn.role === 'ai');
  const coveredTopics = [...new Set(aiTurns.map((turn) => turn.metadata?.topic).filter(Boolean))];
  const priorityTopics = ensureArray(session.analysisResult?.matchingDetails?.questionPlanHints?.priorityTopics);
  const missingTopics = priorityTopics.filter((topic) => !coveredTopics.includes(topic));
  return { coveredTopics, missingTopics, weakAreas: ensureArray(session.analysisResult?.explanation?.gaps) };
};

const buildControllerContext = ({ scenario = {}, evaluatorOutput = null } = {}) => {
  const session = scenario.session || {};
  const environment = buildInterviewEnvironment({ session });
  const coverageState = buildCoverageState(session);
  const dynamicSlotState = deriveDynamicSlots({
    latestAnswer: environment.latestAnswer.text,
    coverageState,
    existingState: { activeSlots: [], activeSlotTopics: [], prunedSlots: [] },
  });
  const currentTopic = environment.questionContext.latestQuestionTopic
    || dynamicSlotState.activeSlotTopics?.[0]
    || coverageState.missingTopics?.[0]
    || 'role_fit';
  const candidateState = { specificityLevel: evaluatorOutput?.specificity || (environment.latestAnswer.tokenCount >= 20 ? 'medium' : 'low') };
  const matchState = { validationTargets: ensureArray(session.analysisResult?.matchingDetails?.validationTargets) };
  const abductiveState = deriveAbductiveState({
    latestAnswer: environment.latestAnswer.text,
    currentTopic,
    candidateState,
    dynamicSlotState,
  });
  const currentSection = inferInterviewSection({
    currentStage: environment.questionContext.latestQuestionStage,
    currentTopic,
    coverageState,
    dynamicSlotState,
  });
  const sectionState = buildSectionState({ currentSection, coverageState, dynamicSlotState });

  return {
    taskType: 'interview_next_turn',
    sessionId: session.id,
    userId: session.userId,
    currentStage: environment.questionContext.latestQuestionStage,
    currentTopic,
    currentObjective: `collect evidence for ${currentTopic}`,
    environment,
    evaluatorState: evaluatorOutput,
    candidateState,
    coverageState,
    matchState,
    dynamicSlotState,
    abductiveState,
    sectionState,
    interviewStructure: { focusAreaKey: scenario.focusArea || session.settings?.focusArea || 'combined' },
    retrievalState: { latestSources: ['cv_profile', 'jd_rubric', 'prepared_question_pool', 'transcript'], sourceQuality: 'available' },
    constraints: { maxQuestionLength: 'short', keepTalkTimeHigh: true, avoidRedundantTopics: true },
  };
};

const summarizeEvaluatorOutput = (output = {}) => ({
  successStatus: output.successStatus || '',
  suggestedNextMode: output.suggestedNextMode || '',
  specificity: output.specificity || '',
  evidenceGainScore: output.evidenceGainScore ?? null,
  misunderstandingFlag: Boolean(output.misunderstandingFlag),
  interactionStatus: output.interactionStatus || '',
  currentTopic: output.currentTopic || '',
  rationale: output.rationale || '',
  plannerSignals: output.plannerSignals || null,
});

const summarizePlan = (plan = {}) => ({
  selectedAction: plan.selectedAction || '',
  fallbackAction: plan.fallbackAction || null,
  recommendedAction: plan.recommendedAction || null,
  selectionSource: plan.selectionSource || 'rule_fallback',
  rationale: plan.rationale || '',
  confidence: plan.confidence ?? null,
  actionInput: plan.actionInput || {},
  candidateActions: ensureArray(plan.candidateActions).slice(0, 5),
});

const selectedQuestionFromTurnPlan = ({ turnPlan = {}, selectedAction = '', decisionContext = {} } = {}) => {
  if (turnPlan.selectedRootCandidate) {
    return {
      id: turnPlan.selectedRootCandidate.questionId,
      sourceId: turnPlan.selectedRootCandidate.questionId,
      preparedQuestionId: turnPlan.selectedRootCandidate.questionId,
      sourceType: turnPlan.selectedRootCandidate.sourceType,
      stage: turnPlan.selectedRootCandidate.sourceStage || turnPlan.selectedRootCandidate.category,
      category: turnPlan.selectedRootCandidate.category,
      topic: turnPlan.selectedRootCandidate.topic,
      text: turnPlan.selectedRootCandidate.text,
      fallbackText: turnPlan.selectedRootCandidate.text,
      evidenceNeed: turnPlan.selectedRootCandidate.evidenceNeed,
      reason: `Selected from prepared root question pool (${turnPlan.selectedRootCandidate.sourceStage || 'prepared'}).`,
      rankTrace: turnPlan.selectedRootCandidate.rankTrace,
    };
  }

  if (turnPlan.turnKind === 'repair') {
    return {
      id: `repair:${decisionContext.currentTopic || 'topic'}`,
      sourceType: 'controller_directed',
      stage: 'repair',
      category: 'repair',
      topic: decisionContext.currentTopic || 'role_fit',
      text: `Let me ask that another way: can you walk me through one concrete example about ${decisionContext.currentTopic || 'that topic'}?`,
      fallbackText: `Let me ask that another way: can you walk me through one concrete example about ${decisionContext.currentTopic || 'that topic'}?`,
      evidenceNeed: ['clarified_understanding'],
      reason: 'The evaluator flagged likely misunderstanding, so the controller rephrased the topic.',
    };
  }

  if (turnPlan.turnKind === 'follow_up') {
    return {
      id: `follow_up:${turnPlan.followUpContext?.parentQuestionId || 'parent'}`,
      sourceType: 'controller_directed',
      stage: 'follow_up',
      category: decisionContext.interviewStructure?.focusAreaKey === 'behavioural' ? 'behavioural' : 'technical',
      topic: turnPlan.followUpContext?.parentTopic || decisionContext.currentTopic || 'role_fit',
      text: `Can you go one level deeper on ${turnPlan.followUpContext?.parentTopic || decisionContext.currentTopic || 'that example'} and explain what you personally did?`,
      fallbackText: `Can you go one level deeper on ${turnPlan.followUpContext?.parentTopic || decisionContext.currentTopic || 'that example'} and explain what you personally did?`,
      evidenceNeed: turnPlan.followUpContext?.missingEvidence || ['personal_action'],
      parentQuestionId: turnPlan.followUpContext?.parentQuestionId || null,
      parentPreparedQuestionId: turnPlan.followUpContext?.parentPreparedQuestionId || null,
      followUpDepth: turnPlan.followUpContext?.followUpDepth || 1,
      reason: 'The latest answer was shallow but contentful, so the controller preserved a follow-up lane without consuming a prepared root question.',
    };
  }

  return {
    id: `controller:${selectedAction || 'question'}`,
    sourceType: 'controller_directed',
    stage: selectedAction === AGENT_ACTION_TYPES.SHIFT_SECTION ? 'section_shift' : 'adaptive',
    category: selectedAction === AGENT_ACTION_TYPES.SHIFT_SECTION ? 'behavioural' : 'technical',
    topic: decisionContext.sectionState?.nextSectionKey || decisionContext.currentTopic || 'role_fit',
    text: selectedAction === AGENT_ACTION_TYPES.SHIFT_SECTION
      ? 'Let us shift topics. Tell me about a teamwork challenge and what you personally did.'
      : `Tell me about one concrete example related to ${decisionContext.currentTopic || 'this role'}.`,
    fallbackText: selectedAction === AGENT_ACTION_TYPES.SHIFT_SECTION
      ? 'Let us shift topics. Tell me about a teamwork challenge and what you personally did.'
      : `Tell me about one concrete example related to ${decisionContext.currentTopic || 'this role'}.`,
    evidenceNeed: ['direct_evidence'],
    reason: 'The controller selected a generated adaptive question when no prepared root item was selected.',
  };
};

const buildQuestionChecks = ({ scenario = {}, evaluatorOutput = {}, plan = {}, rankedPool = [], turnPlan = {}, selectedQuestion = {}, questionDecision = {}, qualityScore = null } = {}) => {
  const contract = scenario.contract || {};
  const checks = [
    {
      label: 'selected_action_matches_contract',
      passed: !contract.selectedAction || plan.selectedAction === contract.selectedAction || scenario.forcedAction === contract.selectedAction,
    },
  ];

  if (contract.suggestedNextMode) {
    checks.push({
      label: 'suggested_next_mode_matches_contract',
      passed: evaluatorOutput.suggestedNextMode === contract.suggestedNextMode,
    });
  }

  if (contract.turnKind) {
    checks.push({ label: 'turn_kind_matches_contract', passed: turnPlan.turnKind === contract.turnKind });
  }

  if (contract.scenario) {
    checks.push({ label: 'turn_scenario_matches_contract', passed: turnPlan.scenario === contract.scenario });
  }

  if (contract.selectedPreparedQuestionId) {
    checks.push({
      label: 'prepared_question_selected',
      passed: selectedQuestion.preparedQuestionId === contract.selectedPreparedQuestionId,
    });
  }

  if (contract.selectionSource) {
    checks.push({
      label: 'selection_source_matches_contract',
      passed: questionDecision.selectionSource === contract.selectionSource,
    });
  }

  if (Object.prototype.hasOwnProperty.call(contract, 'preparedQuestionConsumed')) {
    checks.push({
      label: 'prepared_root_consumption_matches_contract',
      passed: Boolean(selectedQuestion.preparedQuestionId) === contract.preparedQuestionConsumed,
    });
  }

  if (contract.sourcePolicy) {
    checks.push({
      label: 'source_policy_matches_contract',
      passed: turnPlan.sourcePolicy === contract.sourcePolicy,
    });
  }

  if (contract.selectedCategory) {
    checks.push({
      label: 'mode_boundary_kept',
      passed: selectedQuestion.category === contract.selectedCategory && rankedPool[0]?.category === contract.selectedCategory,
    });
  }

  checks.push(
    { label: 'question_decision_present', passed: Boolean(questionDecision.selectedQuestionId && questionDecision.whyThisQuestion) },
    { label: 'question_ranking_present', passed: Boolean(questionDecision.ranking?.topCandidates?.length) },
    { label: 'question_quality_not_empty', passed: !qualityScore || Number(qualityScore.score) > 0 },
  );

  return scoreChecks(checks);
};

const buildPromptText = (scenario = {}) => [
  `Evaluate Kiwi question agent case: ${scenario.id}.`,
  scenario.prompt,
  'Assess answer evaluation, action selection, prepared-pool ranking, turn classification, question quality, and questionDecision/questionRanking transparency.',
].join('\n');

const buildFinalResponseText = ({ scenario = {}, evaluation = {}, plan = {}, turnPlan = {}, selectedQuestion = {} } = {}) => [
  `Question case ${scenario.id}: ${evaluation.passed ? 'passed' : 'needs attention'}.`,
  `Selected action: ${plan.selectedAction || scenario.forcedAction || 'unknown'}.`,
  `Turn kind: ${turnPlan.turnKind || 'unknown'}; selected question: ${selectedQuestion.text || 'none'}.`,
  evaluation.failedChecks.length
    ? `Deterministic checks flagged: ${evaluation.failedChecks.join(', ')}.`
    : 'Deterministic checks did not flag failures.',
].join('\n');

const runQuestionScenario = async (scenario = {}) => {
  const environment = buildInterviewEnvironment({ session: scenario.session });
  const evaluatorOutput = evaluateInterviewTurn({ environment });
  const decisionContext = buildControllerContext({ scenario, evaluatorOutput });
  const fallbackPlan = selectNextAction(decisionContext);
  const plan = scenario.forcedAction
    ? {
        ...fallbackPlan,
        selectedAction: scenario.forcedAction,
        actionInput: {
          ...(fallbackPlan.actionInput || {}),
          actionType: scenario.forcedAction,
          targetTopic: decisionContext.matchState.validationTargets[0] || decisionContext.currentTopic,
          category: scenario.focusArea === 'technical' ? 'technical' : null,
        },
        selectionSource: 'eval_forced_contract_path',
      }
    : fallbackPlan;
  const rankedPool = rankPreparedQuestionPool({
    poolItems: scenario.poolItems,
    session: scenario.session,
    decisionContext,
    evaluatorState: evaluatorOutput,
    actionInput: { ...(plan.actionInput || {}), actionType: plan.selectedAction },
  });
  const turnPlan = await buildInterviewTurnPlan({
    session: scenario.session,
    actionType: plan.selectedAction,
    decisionContext,
    actionInput: { ...(plan.actionInput || {}), actionType: plan.selectedAction },
    poolItems: scenario.poolItems,
  });
  const selectedQuestion = selectedQuestionFromTurnPlan({
    turnPlan,
    selectedAction: plan.selectedAction,
    decisionContext,
  });
  const displayText = selectedQuestion.fallbackText || selectedQuestion.text;
  const questionDecision = buildQuestionDecisionTrace({
    selectedQuestion,
    session: scenario.session,
    decisionContext,
    selectedAction: plan.selectedAction,
    actionInput: plan.actionInput,
    generatedText: displayText,
    confidence: plan.confidence || null,
    selectionSource: selectedQuestion.preparedQuestionId ? 'prepared_question_pool' : plan.selectionSource || 'rule_fallback',
  });
  questionDecision.turnKind = turnPlan.turnKind;
  questionDecision.scenario = turnPlan.scenario;
  questionDecision.sourcePolicy = turnPlan.sourcePolicy;
  questionDecision.topRootCandidates = turnPlan.topRootCandidates;
  questionDecision.parentQuestionId = selectedQuestion.parentQuestionId || turnPlan.followUpContext?.parentQuestionId || null;
  questionDecision.parentPreparedQuestionId = selectedQuestion.parentPreparedQuestionId || turnPlan.followUpContext?.parentPreparedQuestionId || null;
  questionDecision.followUpDepth = selectedQuestion.followUpDepth || turnPlan.followUpContext?.followUpDepth || 0;
  questionDecision.rankTrace = selectedQuestion.rankTrace || null;
  if (selectedQuestion.preparedQuestionId) {
    questionDecision.preparedQuestionId = selectedQuestion.preparedQuestionId;
  }

  const qualityScore = judgeQuestionQuality({
    question: displayText,
    previousQuestions: ensureArray(scenario.session.transcript).filter((turn) => turn.role === 'ai').map((turn) => turn.text),
    cvProfile: {
      skills: scenario.session.analysisResult?.parsedCvProfile?.skills || [],
      projects: scenario.session.analysisResult?.parsedCvProfile?.projects || [],
    },
    jdProfile: {
      requiredSkills: scenario.session.analysisResult?.parsedJdProfile?.requiredSkills || [],
      priorityTopics: scenario.session.analysisResult?.matchingDetails?.questionPlanHints?.priorityTopics || [],
    },
    expectedDifficulty: 'intermediate',
  });
  const evaluation = {
    ...buildQuestionChecks({
      scenario,
      evaluatorOutput,
      plan,
      rankedPool,
      turnPlan,
      selectedQuestion,
      questionDecision,
      qualityScore,
    }),
    minimumPassingScore: 0.85,
  };
  evaluation.passed = evaluation.score >= evaluation.minimumPassingScore && evaluation.failedChecks.length === 0;

  return {
    environment,
    evaluatorOutput,
    decisionContext,
    fallbackPlan,
    plan,
    rankedPool,
    turnPlan,
    selectedQuestion,
    questionDecision,
    qualityScore,
    evaluation,
  };
};

const buildEventsForScenario = ({ scenario = {}, run = {} } = {}) => {
  const prompt = buildPromptText(scenario);
  const latestAi = latestAiTurn(scenario.session);
  return [
    textEvent({ author: 'user', text: prompt }),
    toolCallEvent({
      author: QUESTION_AGENT_ID,
      name: 'load_question_eval_session',
      args: { caseId: scenario.id, sessionId: scenario.session.id },
    }),
    toolResponseEvent({
      name: 'load_question_eval_session',
      response: {
        targetRole: scenario.session.targetRole,
        focusArea: scenario.focusArea,
        latestQuestion: latestAi ? { text: latestAi.text, metadata: latestAi.metadata || {} } : null,
        latestAnswer: truncate(latestUserAnswer(scenario.session), 300),
        poolSize: ensureArray(scenario.poolItems).length,
      },
    }),
    toolCallEvent({
      author: EVALUATOR_ID,
      name: 'evaluate_interview_turn',
      args: { latestAnswer: truncate(latestUserAnswer(scenario.session), 300) },
    }),
    toolResponseEvent({
      name: 'evaluate_interview_turn',
      response: summarizeEvaluatorOutput(run.evaluatorOutput),
    }),
    toolCallEvent({
      author: ACTION_PLANNER_ID,
      name: 'select_next_action',
      args: {
        currentStage: run.decisionContext.currentStage,
        currentTopic: run.decisionContext.currentTopic,
        candidateState: run.decisionContext.candidateState,
        matchState: run.decisionContext.matchState,
      },
    }),
    toolResponseEvent({
      name: 'select_next_action',
      response: summarizePlan(run.plan),
    }),
    toolCallEvent({
      author: POOL_RANKER_ID,
      name: 'rank_prepared_question_pool',
      args: {
        focusArea: scenario.focusArea,
        selectedAction: run.plan.selectedAction,
        validationTargets: run.decisionContext.matchState.validationTargets,
      },
    }),
    toolResponseEvent({
      name: 'rank_prepared_question_pool',
      response: {
        topCandidates: ensureArray(run.rankedPool).slice(0, 5).map((item) => ({
          questionId: item.questionId,
          topic: item.topic,
          category: item.category,
          sourceType: item.sourceType,
          score: item.score,
          reasons: item.reasons,
          penalties: item.penalties,
        })),
      },
    }),
    toolCallEvent({
      author: TURN_ORCHESTRATOR_ID,
      name: 'build_interview_turn_plan',
      args: {
        selectedAction: run.plan.selectedAction,
        latestAnswer: truncate(latestUserAnswer(scenario.session), 240),
      },
    }),
    toolResponseEvent({
      name: 'build_interview_turn_plan',
      response: {
        turnKind: run.turnPlan.turnKind,
        scenario: run.turnPlan.scenario,
        sourcePolicy: run.turnPlan.sourcePolicy,
        selectedRootCandidate: run.turnPlan.selectedRootCandidate,
        topRootCandidates: run.turnPlan.topRootCandidates,
        followUpContext: run.turnPlan.followUpContext,
        latency: run.turnPlan.latency,
      },
    }),
    toolCallEvent({
      author: QUESTION_DECISION_ID,
      name: 'build_question_decision_trace',
      args: {
        selectedQuestionId: run.selectedQuestion.id || run.selectedQuestion.preparedQuestionId || null,
        selectedAction: run.plan.selectedAction,
      },
    }),
    toolResponseEvent({
      name: 'build_question_decision_trace',
      response: {
        questionDecision: run.questionDecision,
        questionRanking: run.questionDecision.ranking,
        questionQuality: {
          score: run.qualityScore.score,
          failedChecks: run.qualityScore.failedChecks,
        },
      },
    }),
    textEvent({ author: QUESTION_AGENT_ID, text: run.selectedQuestion.fallbackText || run.selectedQuestion.text }),
  ];
};

const buildRubricGroup = () => ({
  rubrics: [
    {
      rubric_id: 'controller_action_fit',
      content: { property: { description: 'The controller should select the action implied by the latest answer, coverage, validation targets, and interview mode.' } },
    },
    {
      rubric_id: 'prepared_pool_ranking',
      content: { property: { description: 'Prepared root questions should be ranked by validation targets, coverage gaps, mode fit, freshness, and penalties.' } },
    },
    {
      rubric_id: 'follow_up_root_separation',
      content: { property: { description: 'Follow-up turns must preserve parent/root linkage and must not consume prepared root questions.' } },
    },
    {
      rubric_id: 'question_decision_transparency',
      content: { property: { description: 'Question metadata should include selected action, selected question, source type, evidence, expected signal, alternatives, ranking, and spoken text.' } },
    },
  ],
});

export const buildQuestionAgentEvalCase = async (scenario = {}, index = 0) => {
  const run = await runQuestionScenario(scenario);
  const finalText = buildFinalResponseText({
    scenario,
    evaluation: run.evaluation,
    plan: run.plan,
    turnPlan: run.turnPlan,
    selectedQuestion: run.selectedQuestion,
  });
  const promptText = buildPromptText(scenario);
  return {
    eval_case_id: scenario.id || `question_agent_${index + 1}`,
    prompt: {
      role: 'user',
      parts: [toTextPart(promptText)],
    },
    responses: [
      {
        response: {
          role: 'model',
          parts: [toTextPart(finalText)],
        },
      },
    ],
    agent_data: {
      agents: buildAgents(),
      turns: [
        {
          turn_index: 0,
          events: [
            ...buildEventsForScenario({ scenario, run }),
            textEvent({ author: QUESTION_AGENT_ID, text: finalText }),
          ],
        },
      ],
    },
    rubric_groups: {
      kiwi_question_agent_rubrics: buildRubricGroup(),
    },
    kiwi_evaluation: {
      domain: 'question_agent',
      score: run.evaluation.score,
      passed: run.evaluation.passed,
      minimumPassingScore: run.evaluation.minimumPassingScore,
      failedChecks: run.evaluation.failedChecks,
      checks: run.evaluation.checks,
      diagnostics: {
        selectedAction: run.plan.selectedAction,
        suggestedNextMode: run.evaluatorOutput.suggestedNextMode,
        selectedQuestionId: run.questionDecision.selectedQuestionId,
        turnKind: run.turnPlan.turnKind,
        sourcePolicy: run.turnPlan.sourcePolicy,
        selectionSource: run.questionDecision.selectionSource,
        questionQuality: run.qualityScore,
      },
    },
  };
};

export const buildQuestionAgentDataset = async (scenarios = QUESTION_SCENARIOS) => ({
  eval_cases: await Promise.all(ensureArray(scenarios).map((scenario, index) => buildQuestionAgentEvalCase(scenario, index))),
});

export const getQuestionAgentScenarios = () => QUESTION_SCENARIOS.map((scenario) => ({ ...scenario }));
