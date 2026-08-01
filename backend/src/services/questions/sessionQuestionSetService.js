import { InterviewPlan } from '../../db/models/interviewPlanModel.js';
import { ensureArray, normalizeKey, normalizeText, tokenize } from '../../utils/commonHelpers.js';
import { buildAssessmentKey, buildQuestionFingerprint } from './questionDeduplicationService.js';

export const SESSION_QUESTION_SET_VERSION = 'session_question_set_v1';
export const QUESTION_SELECTION_POLICY_VERSION = 'question_selection_policy_v1';

export const QUESTION_COVERAGE_STATUS = Object.freeze({
  UNSEEN: 'unseen',
  ASKED_UNCONFIRMED: 'asked_unconfirmed',
  ANSWERED_WEAK: 'answered_weak',
  ANSWERED_PARTIAL: 'answered_partial',
  ANSWERED_STRONG: 'answered_strong',
  NEEDS_FOLLOW_UP: 'needs_follow_up',
  BLOCKED: 'blocked',
});

export const QUESTION_COVERAGE_TRANSITIONS = Object.freeze({
  [QUESTION_COVERAGE_STATUS.UNSEEN]: [
    QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED,
    QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
    QUESTION_COVERAGE_STATUS.BLOCKED,
  ],
  [QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED]: [
    QUESTION_COVERAGE_STATUS.ANSWERED_WEAK,
    QUESTION_COVERAGE_STATUS.ANSWERED_PARTIAL,
    QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
    QUESTION_COVERAGE_STATUS.NEEDS_FOLLOW_UP,
    QUESTION_COVERAGE_STATUS.BLOCKED,
  ],
  [QUESTION_COVERAGE_STATUS.ANSWERED_WEAK]: [
    QUESTION_COVERAGE_STATUS.NEEDS_FOLLOW_UP,
    QUESTION_COVERAGE_STATUS.BLOCKED,
  ],
  [QUESTION_COVERAGE_STATUS.ANSWERED_PARTIAL]: [
    QUESTION_COVERAGE_STATUS.NEEDS_FOLLOW_UP,
    QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
    QUESTION_COVERAGE_STATUS.BLOCKED,
  ],
  [QUESTION_COVERAGE_STATUS.ANSWERED_STRONG]: [],
  [QUESTION_COVERAGE_STATUS.NEEDS_FOLLOW_UP]: [
    QUESTION_COVERAGE_STATUS.ANSWERED_WEAK,
    QUESTION_COVERAGE_STATUS.ANSWERED_PARTIAL,
    QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
    QUESTION_COVERAGE_STATUS.BLOCKED,
  ],
  [QUESTION_COVERAGE_STATUS.BLOCKED]: [],
});

export const QUESTION_DECISION_EXCLUSION_REASONS = Object.freeze([
  'already_asked',
  'target_strong',
  'phase_ineligible',
  'question_kind_ineligible',
  'duplicate_assessment',
  'blocked_target',
  'target_in_progress',
  'target_needs_follow_up',
  'not_ranked',
]);

export const QUESTION_DECISION_TRACE_CONTRACT = Object.freeze({
  maxRankedCandidates: 5,
  maxExcludedCandidates: 12,
  requiredFields: [
    'turn',
    'phase',
    'selectedQuestionId',
    'targetId',
    'coverageBefore',
    'coverageAfter',
    'rankedCandidates',
    'excludedCandidates',
  ],
  rankedCandidateFields: ['questionId', 'targetId', 'score', 'reasons'],
  excludedCandidateFields: ['questionId', 'targetId', 'reason'],
  exclusionReasons: QUESTION_DECISION_EXCLUSION_REASONS,
});

export const canTransitionQuestionCoverage = ({ from, to } = {}) => (
  ensureArray(QUESTION_COVERAGE_TRANSITIONS[from]).includes(to)
);

const ROOT_COVERAGE_EXCLUSIONS = new Set([
  QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED,
  QUESTION_COVERAGE_STATUS.ANSWERED_WEAK,
  QUESTION_COVERAGE_STATUS.ANSWERED_PARTIAL,
  QUESTION_COVERAGE_STATUS.NEEDS_FOLLOW_UP,
  QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
  QUESTION_COVERAGE_STATUS.BLOCKED,
]);

const MAX_RUNTIME_MUTATION_ATTEMPTS = 2;
const TARGET_TERM_STOPWORDS = new Set([
  'about', 'and', 'are', 'been', 'candidate', 'data', 'describe', 'experience', 'from', 'have', 'how',
  'interview', 'into', 'most', 'project', 'question', 'role', 'tell', 'that', 'the', 'this', 'was', 'what', 'with', 'your',
]);

const resolveQuestionLimit = ({ settings = {}, items = [] } = {}) => {
  const configured = Number(settings.questionLimit || settings.totalQuestions);
  if (Number.isFinite(configured) && configured > 0) return configured;
  return Math.max(1, ensureArray(items).filter((item) => item?.questionRole !== 'wrap_up').length || 1);
};

const resolveCoreTurnSlot = ({ turn, questionLimit } = {}) => {
  const progressiveTurnCount = Math.max(1, questionLimit - 2);
  const relativePosition = (turn - 2) / Math.max(1, progressiveTurnCount - 1);
  if (relativePosition < 0.35) {
    return {
      phase: 'evidence_foundation',
      intendedPurpose: 'establish_relevant_baseline_evidence',
      policyReason: 'progressive_band:foundation',
    };
  }
  if (relativePosition < 0.75) {
    return {
      phase: 'evidence_depth',
      intendedPurpose: 'test_personal_ownership_and_validation',
      policyReason: 'progressive_band:depth',
    };
  }
  return {
    phase: 'tradeoff_stress',
    intendedPurpose: 'test_constraints_tradeoffs_and_judgement',
    policyReason: 'progressive_band:stress',
  };
};

export const buildQuestionTurnSlots = ({ settings = {}, items = [] } = {}) => {
  const questionLimit = resolveQuestionLimit({ settings, items });
  return Array.from({ length: questionLimit }, (_value, index) => {
    const turn = index + 1;
    if (turn === 1) {
      return {
        turn,
        phase: 'warm_up',
        allowedQuestionKinds: ['root_question'],
        intendedPurpose: 'establish_candidate_context',
        policyReason: 'first_countable_turn_candidate_context',
      };
    }
    if (turn === questionLimit) {
      return {
        turn,
        phase: 'closing',
        allowedQuestionKinds: ['root_question'],
        intendedPurpose: 'synthesize_and_close_interview',
        policyReason: 'last_countable_turn_reserved_for_closure',
      };
    }
    return {
      turn,
      allowedQuestionKinds: ['root_question', 'follow_up'],
      ...resolveCoreTurnSlot({ turn, questionLimit }),
    };
  });
};

export const getQuestionTurnSlot = ({ questionSet = {}, turn } = {}) => (
  ensureArray(questionSet?.definition?.turnSlots).find((slot) => Number(slot?.turn) === Number(turn)) || null
);

const getQuestionTargetId = ({ questionSet = {}, questionId = '', item = {} } = {}) => (
  questionSet?.definition?.questionMap?.[questionId]?.targetId
  || item?.targetId
  || null
);

const isCandidateEligibleForPhase = ({ item = {}, turnSlot = {} } = {}) => {
  const phase = turnSlot?.phase;
  const category = normalizeKey(item.category || item.stage).replace('behavioral', 'behavioural');
  const questionFamily = normalizeKey(item.questionFamily);
  const questionIntent = normalizeKey(item.questionIntent);
  if (phase === 'warm_up') {
    return category === 'opening' || questionFamily === 'self_intro' || questionIntent.includes('self_intro');
  }
  if (phase === 'closing') {
    return item.questionRole === 'wrap_up' || category === 'closing';
  }
  return category !== 'opening' && category !== 'closing' && item.questionRole !== 'wrap_up';
};

const coverageExclusionReason = (status = '') => {
  if (status === QUESTION_COVERAGE_STATUS.ANSWERED_STRONG) return 'target_strong';
  if (status === QUESTION_COVERAGE_STATUS.BLOCKED) return 'blocked_target';
  if (status === QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED) return 'target_in_progress';
  return 'target_needs_follow_up';
};

export const applySessionQuestionSetSelectionPolicy = ({
  questionSet = {},
  turn,
  requestedTurnKind = 'root_question',
  poolItems = [],
} = {}) => {
  const turnSlot = getQuestionTurnSlot({ questionSet, turn });
  if (!turnSlot) {
    return {
      turnSlot: null,
      turnKind: requestedTurnKind,
      forcedRootQuestion: false,
      candidates: ensureArray(poolItems),
      excludedCandidates: [],
    };
  }
  const allowedQuestionKinds = ensureArray(turnSlot.allowedQuestionKinds);
  const turnKind = allowedQuestionKinds.includes(requestedTurnKind)
    ? requestedTurnKind
    : allowedQuestionKinds.includes('root_question')
      ? 'root_question'
      : requestedTurnKind;
  const forcedRootQuestion = turnKind === 'root_question' && requestedTurnKind !== 'root_question';
  if (turnKind !== 'root_question') {
    return {
      turnSlot,
      turnKind,
      forcedRootQuestion,
      candidates: ensureArray(poolItems),
      excludedCandidates: [],
    };
  }
  const coverageByTargetId = questionSet?.runtimeState?.coverageByTargetId || {};
  const candidates = [];
  const excludedCandidates = [];
  ensureArray(poolItems).forEach((item) => {
    const targetId = getQuestionTargetId({ questionSet, questionId: item.questionId, item });
    if (!isCandidateEligibleForPhase({ item, turnSlot })) {
      excludedCandidates.push({ questionId: item.questionId || null, targetId, reason: 'phase_ineligible' });
      return;
    }
    const coverageStatus = coverageByTargetId[targetId]?.status || QUESTION_COVERAGE_STATUS.UNSEEN;
    if (ROOT_COVERAGE_EXCLUSIONS.has(coverageStatus)) {
      excludedCandidates.push({
        questionId: item.questionId || null,
        targetId,
        reason: coverageExclusionReason(coverageStatus),
      });
      return;
    }
    candidates.push(item);
  });
  return { turnSlot, turnKind, forcedRootQuestion, candidates, excludedCandidates };
};

const resolveTarget = (item = {}) => {
  const coverageContractId = ensureArray(item.coverageContractIds).find(Boolean);
  if (coverageContractId) return { targetId: `coverage_contract:${coverageContractId}`, targetKind: 'coverage_contract' };
  if (item.coverageSlot) return { targetId: `coverage_slot:${item.coverageSlot}`, targetKind: 'coverage_slot' };
  const assessmentKey = item.assessmentKey || buildAssessmentKey(item);
  return { targetId: `assessment:${assessmentKey}`, targetKind: 'assessment' };
};

const snapshotQuestionItem = (item = {}) => {
  const {
    askedAt,
    askedTurnIndex,
    lastRankScore,
    rankTrace,
    status: _status,
    ...immutableItem
  } = item;
  const assessmentKey = immutableItem.assessmentKey || buildAssessmentKey(immutableItem);
  const questionFingerprint = immutableItem.questionFingerprint
    || buildQuestionFingerprint(immutableItem.text || immutableItem.fallbackText || immutableItem.spokenDraft);
  const target = resolveTarget({ ...immutableItem, assessmentKey });
  return {
    ...immutableItem,
    assessmentKey,
    questionFingerprint,
    status: 'active',
    targetId: target.targetId,
    targetKind: target.targetKind,
  };
};

const buildTargetContracts = (items = []) => ensureArray(items).reduce((targets, item) => {
  const existing = targets[item.targetId] || {
    targetId: item.targetId,
    targetKind: item.targetKind,
    questionIds: [],
    expectedSignals: [],
  };
  existing.questionIds = [...new Set([...existing.questionIds, item.questionId].filter(Boolean))];
  existing.expectedSignals = [...new Set([...existing.expectedSignals, ...ensureArray(item.expectedSignal)].filter(Boolean))];
  targets[item.targetId] = existing;
  return targets;
}, {});

const buildQuestionMap = (items = []) => ensureArray(items).reduce((questionMap, item) => {
  if (!item.questionId) return questionMap;
  questionMap[item.questionId] = {
    questionId: item.questionId,
    assessmentKey: item.assessmentKey,
    questionFingerprint: item.questionFingerprint,
    targetId: item.targetId,
    targetKind: item.targetKind,
    labels: {
      category: item.category || '',
      stage: item.stage || '',
      questionFamily: item.questionFamily || '',
      sourceType: item.sourceType || '',
      coverageSlot: item.coverageSlot || '',
    },
  };
  return questionMap;
}, {});

export const buildSessionQuestionSet = ({
  sessionId,
  userId,
  settings = {},
  items = [],
} = {}) => {
  const snapshotItems = ensureArray(items).map(snapshotQuestionItem).filter((item) => item.questionId);
  const targetContracts = buildTargetContracts(snapshotItems);
  return {
    schemaVersion: SESSION_QUESTION_SET_VERSION,
    definition: {
      schemaVersion: SESSION_QUESTION_SET_VERSION,
      selectionPolicyVersion: QUESTION_SELECTION_POLICY_VERSION,
      sessionId: String(sessionId || ''),
      userId: String(userId || ''),
      settings: {
        questionLimit: resolveQuestionLimit({ settings, items: snapshotItems }),
        focusArea: normalizeKey(settings.focusArea || settings.questionType || 'combined'),
        seniorityLevel: normalizeKey(settings.seniorityLevel || 'junior'),
      },
      items: snapshotItems,
      questionMap: buildQuestionMap(snapshotItems),
      targetContracts,
      turnSlots: buildQuestionTurnSlots({ settings, items: snapshotItems }),
      decisionTraceContract: QUESTION_DECISION_TRACE_CONTRACT,
    },
    runtimeState: {
      schemaVersion: 'question_runtime_state_v1',
      coverageStateMachineVersion: 'question_coverage_state_v1',
      revision: 0,
      coverageByTargetId: Object.fromEntries(Object.keys(targetContracts).map((targetId) => [targetId, {
        status: QUESTION_COVERAGE_STATUS.UNSEEN,
        reason: 'initialized_from_canonical_question_set',
      }])),
      decisionsByTurn: [],
    },
  };
};

const resolveLeanDocument = async (value) => {
  if (value?.lean) return value.lean();
  const document = await value;
  return document?.toObject ? document.toObject() : document;
};

export const getSessionQuestionSet = async ({ sessionId, userId = null, planModel = InterviewPlan } = {}) => {
  if (!sessionId) return null;
  const query = { sessionId: String(sessionId) };
  if (userId) query.userId = String(userId);
  const plan = await resolveLeanDocument(planModel.findOne(query));
  return plan?.sessionQuestionSet || null;
};

export const persistSessionQuestionSet = async ({
  sessionId,
  userId,
  settings = {},
  items = [],
  planModel = InterviewPlan,
} = {}) => {
  if (!sessionId || !userId || !ensureArray(items).length) return { questionSet: null, created: false };
  const questionSet = buildSessionQuestionSet({ sessionId, userId, settings, items });
  const plan = await resolveLeanDocument(planModel.findOneAndUpdate(
    {
      sessionId: String(sessionId),
      userId: String(userId),
      'sessionQuestionSet.definition.schemaVersion': { $exists: false },
    },
    { $set: { sessionQuestionSet: questionSet } },
    { new: true },
  ));
  if (plan?.sessionQuestionSet) return { questionSet: plan.sessionQuestionSet, created: true };
  return {
    questionSet: await getSessionQuestionSet({ sessionId, userId, planModel }),
    created: false,
  };
};

export const getSessionQuestionSetItems = (questionSet = {}) => ensureArray(questionSet?.definition?.items);

const normalizeDecisionExclusionReason = (reason = '') => {
  const normalized = normalizeKey(reason);
  if (QUESTION_DECISION_EXCLUSION_REASONS.includes(normalized)) return normalized;
  if (normalized.includes('duplicate')) return 'duplicate_assessment';
  if (normalized.includes('asked')) return 'already_asked';
  return 'not_ranked';
};

const toRankedCandidateTrace = ({ questionSet = {}, candidate = {} } = {}) => {
  const questionId = candidate.questionId || null;
  const rankTrace = candidate.rankTrace || {};
  return {
    questionId,
    targetId: getQuestionTargetId({ questionSet, questionId, item: candidate }),
    score: Number.isFinite(Number(candidate.score))
      ? Number(candidate.score)
      : (Number.isFinite(Number(rankTrace.score)) ? Number(rankTrace.score) : null),
    reasons: {
      reasonCodes: ensureArray(rankTrace.reasons || candidate.reasons).filter(Boolean).slice(0, 12),
      scoreComponents: rankTrace.rootScore?.components || null,
      selectionReason: rankTrace.selectionReason || null,
    },
  };
};

const toExcludedCandidateTrace = ({ questionSet = {}, candidate = {} } = {}) => ({
  questionId: candidate.questionId || null,
  targetId: getQuestionTargetId({ questionSet, questionId: candidate.questionId, item: candidate }),
  reason: normalizeDecisionExclusionReason(candidate.reason),
});

export const buildQuestionSelectionDecision = ({
  questionSet = {},
  turn,
  questionDecision = {},
  policyExcludedCandidates = [],
} = {}) => {
  const selectedQuestionId = questionDecision.preparedQuestionId || questionDecision.selectedQuestionId || null;
  const turnSlot = getQuestionTurnSlot({ questionSet, turn });
  const targetId = getQuestionTargetId({ questionSet, questionId: selectedQuestionId });
  if (!turnSlot || !selectedQuestionId || !targetId) return null;
  const coverageBefore = questionSet?.runtimeState?.coverageByTargetId?.[targetId]?.status || QUESTION_COVERAGE_STATUS.UNSEEN;
  const coverageAfter = canTransitionQuestionCoverage({
    from: coverageBefore,
    to: QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED,
  })
    ? QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED
    : coverageBefore;
  const rankedInput = [
    { questionId: selectedQuestionId, rankTrace: questionDecision.rankTrace || {}, score: questionDecision.rankTrace?.score },
    ...ensureArray(questionDecision.topRootCandidates),
  ];
  const rankedCandidates = [];
  const seenRankedIds = new Set();
  rankedInput.forEach((candidate) => {
    if (!candidate?.questionId || seenRankedIds.has(candidate.questionId)) return;
    seenRankedIds.add(candidate.questionId);
    rankedCandidates.push(toRankedCandidateTrace({ questionSet, candidate }));
  });
  const excludedInput = [
    ...ensureArray(policyExcludedCandidates),
    ...ensureArray(questionDecision.rejectedCandidates),
  ];
  const excludedCandidates = [];
  const seenExcludedKeys = new Set();
  excludedInput.forEach((candidate) => {
    const trace = toExcludedCandidateTrace({ questionSet, candidate });
    const key = `${trace.questionId || ''}:${trace.reason}`;
    if (seenExcludedKeys.has(key)) return;
    seenExcludedKeys.add(key);
    excludedCandidates.push(trace);
  });
  return {
    turn: Number(turn),
    phase: turnSlot.phase,
    allowedQuestionKinds: ensureArray(turnSlot.allowedQuestionKinds),
    intendedPurpose: turnSlot.intendedPurpose,
    policyReason: turnSlot.policyReason,
    selectedQuestionId,
    targetId,
    coverageBefore,
    coverageAfter,
    rankedCandidates: rankedCandidates.slice(0, QUESTION_DECISION_TRACE_CONTRACT.maxRankedCandidates),
    excludedCandidates: excludedCandidates.slice(0, QUESTION_DECISION_TRACE_CONTRACT.maxExcludedCandidates),
  };
};

const cloneRuntimeState = (runtimeState = {}) => JSON.parse(JSON.stringify(runtimeState || {}));

const mutateSessionQuestionSetRuntime = async ({
  sessionId,
  userId,
  mutateRuntimeState,
  planModel = InterviewPlan,
} = {}) => {
  if (!sessionId || !userId || typeof mutateRuntimeState !== 'function') return null;
  for (let attempt = 0; attempt < MAX_RUNTIME_MUTATION_ATTEMPTS; attempt += 1) {
    const plan = await resolveLeanDocument(planModel.findOne({ sessionId: String(sessionId), userId: String(userId) }));
    const questionSet = plan?.sessionQuestionSet;
    if (!questionSet?.definition || !questionSet?.runtimeState) return null;
    const runtimeState = cloneRuntimeState(questionSet.runtimeState);
    const nextRuntimeState = mutateRuntimeState({ questionSet, runtimeState });
    if (!nextRuntimeState) return questionSet;
    const revision = Number(runtimeState.revision || 0);
    nextRuntimeState.revision = revision + 1;
    const updatedPlan = await resolveLeanDocument(planModel.findOneAndUpdate(
      {
        sessionId: String(sessionId),
        userId: String(userId),
        'sessionQuestionSet.runtimeState.revision': revision,
      },
      { $set: { 'sessionQuestionSet.runtimeState': nextRuntimeState } },
      { new: true },
    ));
    if (updatedPlan?.sessionQuestionSet) return updatedPlan.sessionQuestionSet;
  }
  return null;
};

export const recordSessionQuestionSelection = async ({
  sessionId,
  userId,
  turn,
  questionDecision = {},
  policyExcludedCandidates = [],
  planModel = InterviewPlan,
} = {}) => mutateSessionQuestionSetRuntime({
  sessionId,
  userId,
  planModel,
  mutateRuntimeState: ({ questionSet, runtimeState }) => {
    const decision = buildQuestionSelectionDecision({
      questionSet: { ...questionSet, runtimeState },
      turn,
      questionDecision,
      policyExcludedCandidates,
    });
    if (!decision) return null;
    const priorDecision = ensureArray(runtimeState.decisionsByTurn)
      .find((entry) => Number(entry.turn) === Number(turn));
    if (priorDecision) return null;
    runtimeState.coverageByTargetId = runtimeState.coverageByTargetId || {};
    runtimeState.coverageByTargetId[decision.targetId] = {
      ...(runtimeState.coverageByTargetId[decision.targetId] || {}),
      status: decision.coverageAfter,
      reason: 'prepared_root_question_asked',
      lastQuestionId: decision.selectedQuestionId,
    };
    runtimeState.decisionsByTurn = [
      ...ensureArray(runtimeState.decisionsByTurn),
      decision,
    ];
    return runtimeState;
  },
});

const resolveAcceptedAnswerStatus = (evaluation = {}) => {
  if (evaluation?.misunderstandingFlag) return null;
  if (evaluation?.candidateDenial || evaluation?.evidenceStatus === 'EXPLICIT_NO_EXPERIENCE') {
    return QUESTION_COVERAGE_STATUS.BLOCKED;
  }
  if (
    evaluation?.evidenceStatus === 'EXACT_MATCH'
    && Number(evaluation?.evidenceGainScore || 0) >= 0.7
    && evaluation?.successStatus === 'usable'
  ) return QUESTION_COVERAGE_STATUS.ANSWERED_STRONG;
  if (evaluation?.evidenceStatus === 'PARTIAL_TRANSFER' && Number(evaluation?.evidenceGainScore || 0) >= 0.45) {
    return QUESTION_COVERAGE_STATUS.ANSWERED_PARTIAL;
  }
  return QUESTION_COVERAGE_STATUS.ANSWERED_WEAK;
};

const getLatestPreparedRootQuestionId = (transcript = []) => {
  const latestRootTurn = [...ensureArray(transcript)].reverse().find((turn) => {
    if (turn?.role !== 'ai') return false;
    const metadata = turn.metadata || {};
    const preparedQuestionId = metadata.preparedQuestionId || metadata.questionDecision?.preparedQuestionId;
    const turnKind = metadata.turnKind || metadata.questionDecision?.turnKind;
    return Boolean(preparedQuestionId && turnKind === 'root_question');
  });
  return latestRootTurn?.metadata?.preparedQuestionId
    || latestRootTurn?.metadata?.questionDecision?.preparedQuestionId
    || null;
};

const buildTargetTerms = ({ questionSet = {}, targetId = '' } = {}) => uniqueTargetTerms(
  ensureArray(questionSet?.definition?.items)
    .filter((item) => item.targetId === targetId)
    .flatMap((item) => [item.topic, item.competency, item.coverageSlot, ...ensureArray(item.expectedSignal), ...ensureArray(item.evidenceNeed)]),
);

const uniqueTargetTerms = (values = []) => [...new Set(ensureArray(values)
  .flatMap((value) => tokenize(normalizeText(value)))
  .map((token) => normalizeKey(token))
  .filter((token) => token.length >= 3 && !TARGET_TERM_STOPWORDS.has(token)))];

const answerClearlyCoversTarget = ({ questionSet = {}, targetId = '', answerText = '' } = {}) => {
  const answerTokens = new Set(uniqueTargetTerms([answerText]));
  const targetTerms = buildTargetTerms({ questionSet, targetId });
  return targetTerms.filter((term) => answerTokens.has(term)).length >= 2;
};

export const buildAcceptedAnswerCoverageUpdates = ({
  questionSet = {},
  transcript = [],
  answerText = '',
  evaluation = {},
} = {}) => {
  const acceptedStatus = resolveAcceptedAnswerStatus(evaluation);
  const directQuestionId = getLatestPreparedRootQuestionId(transcript);
  const directTargetId = getQuestionTargetId({ questionSet, questionId: directQuestionId });
  if (!acceptedStatus || !normalizeText(answerText) || !directTargetId) return [];
  const coverageByTargetId = questionSet?.runtimeState?.coverageByTargetId || {};
  const updates = [];
  const addUpdate = ({ targetId, nextStatus, reason, implicit = false }) => {
    const fromStatus = coverageByTargetId[targetId]?.status || QUESTION_COVERAGE_STATUS.UNSEEN;
    if (!canTransitionQuestionCoverage({ from: fromStatus, to: nextStatus })) return;
    updates.push({ targetId, fromStatus, toStatus: nextStatus, reason, implicit });
  };
  addUpdate({
    targetId: directTargetId,
    nextStatus: acceptedStatus,
    reason: 'accepted_answer_for_asked_target',
  });
  if (acceptedStatus === QUESTION_COVERAGE_STATUS.ANSWERED_STRONG) {
    Object.keys(questionSet?.definition?.targetContracts || {}).forEach((targetId) => {
      if (targetId === directTargetId || !answerClearlyCoversTarget({ questionSet, targetId, answerText })) return;
      addUpdate({
        targetId,
        nextStatus: QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
        reason: 'accepted_answer_clearly_covers_unasked_target',
        implicit: true,
      });
    });
  }
  return updates;
};

export const recordAcceptedAnswerCoverage = async ({
  sessionId,
  userId,
  transcript = [],
  answerText = '',
  evaluation = {},
  planModel = InterviewPlan,
} = {}) => mutateSessionQuestionSetRuntime({
  sessionId,
  userId,
  planModel,
  mutateRuntimeState: ({ questionSet, runtimeState }) => {
    const updates = buildAcceptedAnswerCoverageUpdates({
      questionSet: { ...questionSet, runtimeState },
      transcript,
      answerText,
      evaluation,
    });
    if (!updates.length) return null;
    runtimeState.coverageByTargetId = runtimeState.coverageByTargetId || {};
    updates.forEach((update) => {
      runtimeState.coverageByTargetId[update.targetId] = {
        ...(runtimeState.coverageByTargetId[update.targetId] || {}),
        status: update.toStatus,
        reason: update.reason,
        implicitCoverage: update.implicit,
        lastEvidenceGainScore: Number(evaluation.evidenceGainScore || 0),
      };
    });
    return runtimeState;
  },
});
