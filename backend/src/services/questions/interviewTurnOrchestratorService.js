import { AGENT_ACTION_TYPES } from '../../constants/agentActionTypes.js';
import { ensureArray, normalizeKey, normalizeText, tokenize, unique } from '../../utils/commonHelpers.js';
import { getPreparedQuestionPool } from './questionPoolComposerService.js';
import { rankPreparedQuestionPool, selectBestPreparedQuestion } from './questionPoolRankerService.js';

export const ROOT_SCENARIOS = new Set([
  'root_cv_evidence',
  'root_jd_requirement',
  'root_match_gap',
  'root_behavioural',
  'root_motivation',
  'root_wrap_up',
  'root_fallback',
]);

export const FOLLOW_UP_SCENARIOS = new Set([
  'intro_follow_up',
  'follow_up_ownership',
  'follow_up_technical_depth',
  'follow_up_tradeoff',
  'follow_up_validation',
  'follow_up_result',
  'follow_up_failure',
  'follow_up_constraint',
  'follow_up_reflection',
  'follow_up_behavioural_action',
]);

export const REPAIR_SCENARIOS = new Set([
  'rephrase',
  'scaffold',
  'clarify_audio_or_transcript',
  'switch_topic',
  'shift_section',
  'wrap_up',
]);

const FOLLOW_UP_ACTIONS = new Set([
  AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
  AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
  AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION,
  AGENT_ACTION_TYPES.PROBE_STRESS,
  AGENT_ACTION_TYPES.PROBE_FRICTION,
]);

const ROOT_ACTIONS = new Set([
  AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
  AGENT_ACTION_TYPES.ASK_RETRIEVED_QUESTION,
  AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
  AGENT_ACTION_TYPES.SWITCH_TOPIC,
  AGENT_ACTION_TYPES.SHIFT_SECTION,
  AGENT_ACTION_TYPES.WRAP_STAGE,
  AGENT_ACTION_TYPES.ANSWER_CANDIDATE_QUESTION,
]);

const REPAIR_ACTIONS = new Set([
  AGENT_ACTION_TYPES.REPHRASE_QUESTION,
  AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION,
]);

const normalizeMode = (value = 'combined') => {
  const key = normalizeKey(value).replace('behavioral', 'behavioural');
  if (key === 'technical') return 'technical';
  if (key === 'behavioural') return 'behavioural';
  return 'combined';
};

const latestTurn = (session = {}, role = null) => [...ensureArray(session.transcript)]
  .reverse()
  .find((turn) => !role || turn?.role === role) || null;

const followUpIntentForScenario = (scenario = '') => ({
  intro_follow_up: 'clarification',
  follow_up_ownership: 'ownership',
  follow_up_technical_depth: 'technical_depth',
  follow_up_tradeoff: 'tradeoff',
  follow_up_validation: 'validation',
  follow_up_result: 'result',
  follow_up_failure: 'failure',
  follow_up_constraint: 'constraint',
  follow_up_reflection: 'reflection',
  follow_up_behavioural_action: 'behavioural_action',
}[scenario] || 'clarification');

export const buildCheapAnswerSignals = ({ answerText = '', session = {} } = {}) => {
  const text = normalizeText(answerText || latestTurn(session, 'user')?.text || '');
  const tokens = tokenize(text);
  const lower = text.toLowerCase();
  const mentionedProjects = ensureArray(session.analysisResult?.parsedCvProfile?.evidenceProfile?.sections?.projects || session.analysisResult?.parsedCvProfile?.projects)
    .map((project) => normalizeText(project.title || project.projectTitle || project.name))
    .filter(Boolean)
    .filter((title) => lower.includes(title.toLowerCase()));
  const technologyMentions = unique(tokens.filter((token) => /^(react|node|express|python|java|sql|postgresql|mongodb|azure|aws|api|websocket|typescript|javascript)$/.test(token)));
  const missingEvidence = [
    !/\b(i|my|personally|owned|led|built|implemented|designed|decided)\b/i.test(text) ? 'personal_ownership' : null,
    !/\b(result|impact|improved|reduced|increased|measured|validated|tested|deployed)\b/i.test(text) ? 'result_or_validation' : null,
    !/\b(tradeoff|constraint|challenge|failure|blocked|hard|risk)\b/i.test(text) ? 'tradeoff_or_constraint' : null,
  ].filter(Boolean);

  return {
    text,
    tokenCount: tokens.length,
    isShallow: tokens.length > 0 && tokens.length < 35,
    isContentful: tokens.length >= 8,
    mentionedProjects,
    technologyMentions,
    missingEvidence,
  };
};

const isIntroductionAnswer = (session = {}) => {
  const aiTurn = latestTurn(session, 'ai');
  const stage = normalizeKey(aiTurn?.metadata?.stage || aiTurn?.metadata?.questionType || aiTurn?.metadata?.topic);
  return stage.includes('opening') || stage.includes('self_intro');
};

const resolveTurnKind = ({ actionType, session, answerSignals, decisionContext = {} } = {}) => {
  if (REPAIR_ACTIONS.has(actionType)) return 'repair';
  if (actionType === AGENT_ACTION_TYPES.WRAP_STAGE || decisionContext?.interviewStructure?.isFinalPlannedTurn) return 'root_question';
  if (isIntroductionAnswer(session) && answerSignals.isContentful && answerSignals.isShallow && (answerSignals.mentionedProjects.length || answerSignals.technologyMentions.length)) {
    return 'follow_up';
  }
  if (FOLLOW_UP_ACTIONS.has(actionType)) return 'follow_up';
  if (ROOT_ACTIONS.has(actionType)) return 'root_question';
  return 'root_question';
};

const scenarioForRoot = ({ actionType, selectedCandidate = null, actionInput = {}, decisionContext = {} } = {}) => {
  if (actionType === AGENT_ACTION_TYPES.WRAP_STAGE || actionInput.targetTopic === 'candidate_questions') return 'root_wrap_up';
  if (actionType === AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION || selectedCandidate?.sourceStage === 'match_gap' || selectedCandidate?.sourceType === 'match_gap') return 'root_match_gap';
  if (selectedCandidate?.sourceType === 'jd_requirement' || selectedCandidate?.sourceStage === 'match_validation') return 'root_jd_requirement';
  if (selectedCandidate?.sourceType?.startsWith?.('cv_') || selectedCandidate?.sourceStage === 'cv_seed') return 'root_cv_evidence';
  if (selectedCandidate?.category === 'behavioural' || actionInput.category === 'behavioural') return 'root_behavioural';
  if (normalizeKey(decisionContext?.currentStage).includes('motivation')) return 'root_motivation';
  return selectedCandidate ? 'root_cv_evidence' : 'root_fallback';
};

const scenarioForFollowUp = ({ actionType, answerSignals, actionInput = {}, decisionContext = {} } = {}) => {
  if (answerSignals.mentionedProjects.length && answerSignals.isShallow) return 'intro_follow_up';
  const probeType = normalizeKey(actionInput.probeType || '');
  const missing = answerSignals.missingEvidence;
  if (actionType === AGENT_ACTION_TYPES.PROBE_FRICTION || probeType.includes('failure')) return 'follow_up_failure';
  if (actionType === AGENT_ACTION_TYPES.PROBE_STRESS || probeType.includes('constraint')) return 'follow_up_constraint';
  if (probeType.includes('validation') || missing.includes('result_or_validation')) return 'follow_up_validation';
  if (probeType.includes('tradeoff') || missing.includes('tradeoff_or_constraint')) return 'follow_up_tradeoff';
  if (normalizeMode(decisionContext?.interviewStructure?.focusAreaKey) === 'behavioural') return 'follow_up_behavioural_action';
  if (missing.includes('personal_ownership')) return 'follow_up_ownership';
  return actionType === AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION ? 'follow_up_technical_depth' : 'follow_up_result';
};

const scenarioForRepair = ({ actionType } = {}) => (
  actionType === AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION ? 'scaffold' : 'rephrase'
);

const toRootCandidate = (item = {}) => ({
  questionId: item.questionId || null,
  text: item.spokenDraft || item.fallbackText || item.text || '',
  topic: item.topic || null,
  category: item.category || null,
  sourceType: item.sourceType || null,
  sourceStage: item.sourceStage || null,
  score: item.score ?? null,
  rankTrace: item.rankTrace || null,
  evidenceNeed: item.evidenceNeed || [],
  constraints: item.constraints || [],
  maxFollowUps: item.maxFollowUps ?? 2,
  followUpStrategies: item.followUpStrategies || [],
  questionFamily: item.questionFamily || null,
  evidenceMode: item.evidenceMode || null,
  roleDomain: item.roleDomain || 'general',
  requirementCategory: item.requirementCategory || null,
  capabilityGroup: item.capabilityGroup || null,
});

const buildEvidencePackage = ({ selectedCandidate = null, decisionContext = {}, answerSignals = {} } = {}) => ({
  latestAnswer: {
    tokenCount: answerSignals.tokenCount,
    isShallow: answerSignals.isShallow,
    technologyMentions: answerSignals.technologyMentions,
    mentionedProjects: answerSignals.mentionedProjects,
    missingEvidence: answerSignals.missingEvidence,
  },
  cvEvidence: ensureArray(selectedCandidate?.linkedCvEvidence).slice(0, 3),
  jdRequirements: ensureArray(selectedCandidate?.linkedJdRequirement).slice(0, 3),
  matchTargets: ensureArray(decisionContext?.matchState?.validationTargets).slice(0, 4),
  coverageGaps: ensureArray(decisionContext?.coverageState?.missingTopics).slice(0, 4),
});

const buildFollowUpContext = ({ session = {}, selectedCandidate = null, answerSignals = {}, decisionContext = {} } = {}) => {
  const parentQuestion = latestTurn(session, 'ai');
  const parentMetadata = parentQuestion?.metadata || {};
  const parentDecision = parentMetadata.questionDecision || {};
  const parentPreparedQuestionId = parentDecision.preparedQuestionId || parentMetadata.preparedQuestionId || selectedCandidate?.questionId || null;
  const parentFollowUpDepth = Number(parentMetadata.followUpDepth || 0);
  return {
    parentQuestionId: parentQuestion?.questionId || null,
    rootQuestionId: parentMetadata.rootQuestionId || parentQuestion?.questionId || null,
    parentPreparedQuestionId,
    followUpDepth: parentFollowUpDepth + 1,
    rootTopic: parentMetadata.rootTopic || parentMetadata.topic || decisionContext.currentTopic || selectedCandidate?.topic || null,
    parentTopic: parentMetadata.topic || decisionContext.currentTopic || null,
    missingEvidence: answerSignals.missingEvidence,
    evidenceTarget: answerSignals.missingEvidence[0] || decisionContext.currentTopic || selectedCandidate?.topic || null,
    questionFamily: parentMetadata.questionFamily || null,
    evidenceMode: parentMetadata.evidenceMode || null,
    roleDomain: parentMetadata.roleDomain || 'general',
    requirementCategory: parentMetadata.requirementCategory || null,
    capabilityGroup: parentMetadata.capabilityGroup || null,
  };
};

export const buildBoundedPlanningFrame = ({ turnPlan = {}, mode = 'combined', fallbackDraftQuestion = '' } = {}) => ({
  scenario: turnPlan.scenario,
  turnKind: turnPlan.turnKind,
  parentQuestion: turnPlan.followUpContext?.parentQuestionId ? {
    parentQuestionId: turnPlan.followUpContext.parentQuestionId,
    parentTopic: turnPlan.followUpContext.parentTopic,
    followUpDepth: turnPlan.followUpContext.followUpDepth,
  } : null,
  latestAnswerSignals: turnPlan.answerSignals,
  topRootCandidates: ensureArray(turnPlan.topRootCandidates).slice(0, 3),
  allowedFollowUpIntents: [
    'ownership',
    'technical_depth',
    'validation',
    'tradeoff',
    'result',
    'failure',
    'constraint',
    'reflection',
    'behavioural_action',
    'clarification',
    'scaffold',
  ],
  evidencePackage: turnPlan.evidencePackage,
  mode,
  hardConstraints: [
    'ask_exactly_one_question',
    'do_not_invent_cv_jd_or_transcript_facts',
    'do_not_switch_broad_scenario',
    'final_spoken_question_must_be_tts_ready',
  ],
  forbiddenMoves: [
    'consume_prepared_root_for_follow_up',
    'ask_technical_implementation_in_behavioural_mode',
    'ask_generic_bank_question_when_evidence_available',
  ],
  fallbackDraftQuestion,
});

export const buildInterviewTurnPlan = async ({
  session = {},
  actionType = AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
  decisionContext = {},
  actionInput = {},
  poolItems = null,
} = {}) => {
  const orchestratorStartedAt = Date.now();
  const answerSignalStartedAt = Date.now();
  const answerSignals = buildCheapAnswerSignals({
    answerText: decisionContext?.environment?.latestAnswer?.text || decisionContext?.latestAnswer || '',
    session,
  });
  const answerSignalBuildMs = Date.now() - answerSignalStartedAt;
  const mode = normalizeMode(decisionContext?.interviewStructure?.focusAreaKey || session?.settings?.focusArea || actionInput.category || 'combined');
  const requestedTurnKind = resolveTurnKind({ actionType, session, answerSignals, decisionContext });
  const turnKind = requestedTurnKind === 'follow_up' && !latestTurn(session, 'ai') ? 'root_question' : requestedTurnKind;
  const category = mode === 'technical' ? 'technical' : mode === 'behavioural' ? 'behavioural' : actionInput.category || null;
  let rootPool = poolItems;
  if (!rootPool) {
    try {
      rootPool = await getPreparedQuestionPool({ sessionId: session.id, category });
    } catch {
      rootPool = [];
    }
  }
  const rankStartedAt = Date.now();
  const rankedRootCandidates = rankPreparedQuestionPool({
    poolItems: rootPool,
    session,
    decisionContext,
    evaluatorState: decisionContext.evaluatorState,
    actionInput: { ...actionInput, actionType },
  });
  const rootCandidateRankMs = Date.now() - rankStartedAt;
  const selectedRootCandidate = turnKind === 'root_question' ? selectBestPreparedQuestion(rankedRootCandidates) : null;
  const topRootCandidates = rankedRootCandidates.slice(0, 3).map(toRootCandidate);
  const followUpContextStartedAt = Date.now();
  const followUpContext = turnKind === 'follow_up'
    ? buildFollowUpContext({ session, selectedCandidate: rankedRootCandidates[0], answerSignals, decisionContext })
    : null;
  const followUpContextBuildMs = Date.now() - followUpContextStartedAt;
  const scenario = turnKind === 'repair'
    ? scenarioForRepair({ actionType })
    : turnKind === 'follow_up'
      ? scenarioForFollowUp({ actionType, answerSignals, actionInput, decisionContext })
      : scenarioForRoot({ actionType, selectedCandidate: selectedRootCandidate, actionInput, decisionContext });
  const followUpIntent = turnKind === 'follow_up' ? followUpIntentForScenario(scenario) : null;
  const selectedCandidate = selectedRootCandidate ? toRootCandidate(selectedRootCandidate) : null;
  const evidencePackage = buildEvidencePackage({ selectedCandidate: selectedRootCandidate, decisionContext, answerSignals });

  const turnPlan = {
    turnKind,
    scenario,
    sourcePolicy: turnKind === 'follow_up'
      ? 'follow_up_from_parent_no_prepared_root_consumption'
      : selectedRootCandidate
        ? 'prepared_root_pool'
        : 'fallback_root_policy',
    answerSignals,
    selectedRootCandidate: selectedCandidate,
    topRootCandidates,
    followUpContext: followUpContext ? { ...followUpContext, followUpIntent } : null,
    followUpIntent,
    evidenceTarget: followUpContext?.evidenceTarget || null,
    evidencePackage,
    rankTrace: selectedRootCandidate?.rankTrace || null,
    latency: {
      answerSignalBuildMs,
      rootCandidateRankMs,
      followUpContextBuildMs,
      orchestratorDecisionMs: Date.now() - orchestratorStartedAt,
    },
    poolDegraded: turnKind === 'root_question' && !selectedRootCandidate,
    poolDegradedReason: turnKind === 'root_question' && !selectedRootCandidate ? 'no_ranked_prepared_root_candidate' : null,
  };

  return {
    ...turnPlan,
    planningFrame: buildBoundedPlanningFrame({
      turnPlan,
      mode,
      fallbackDraftQuestion: selectedCandidate?.text || '',
    }),
  };
};
