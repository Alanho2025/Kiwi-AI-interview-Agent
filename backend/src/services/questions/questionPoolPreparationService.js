import { resolveInterviewModeConfig } from '../../config/interviewBlueprints.js';
import { InterviewQuestionPoolItem } from '../../db/models/interviewQuestionPoolItemModel.js';
import { InterviewPlan } from '../../db/models/interviewPlanModel.js';
import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';
import { callDeepSeek } from '../deepseekService.js';
import { buildModeCompatibility, stableQuestionId } from './questionArtifactHelpers.js';
import { composeInterviewQuestionPool } from './questionPoolComposerService.js';
import { loadApprovedQuestionCatalogItems } from './questionCatalogRepository.js';
import {
  resolveCatalogReservationPlan,
  resolveCatalogSelectionContext,
} from './questionCatalogSelectionService.js';
import { assessProofStrategyQuestionCoverage } from './roleFitQuestionCoverageService.js';
import {
  buildAssessmentKey,
  buildQuestionFingerprint,
  buildQuestionHistory,
  filterNovelQuestionCandidates,
} from './questionDeduplicationService.js';

const RESERVE_BUFFER_SIZE = 2;
const MAX_RESERVE_QUESTIONS = 3;
const isVoiceDeliveryMode = (value = '') => normalizeKey(value) === 'voice';

const buildCatalogPreparationCoverage = ({
  deliveryMode = 'text',
  catalogLoad = {},
  items = [],
  settings = {},
  analysisResult = {},
} = {}) => {
  if (!isVoiceDeliveryMode(deliveryMode)) return { status: 'not_applicable', reservations: [] };
  if (catalogLoad.status !== 'ready') return { status: catalogLoad.status || 'catalog_unavailable', reservations: [] };
  const selectionContext = resolveCatalogSelectionContext({ analysisResult, settings });
  const plan = resolveCatalogReservationPlan({
    poolItems: items,
    selectionContext,
    catalogStatus: 'ready',
    session: {
      analysisResult,
      settings,
      currentQuestionIndex: 1,
      questionLimit: settings.questionLimit || settings.totalQuestions || 8,
      transcript: [],
    },
  });
  const reservations = plan.reservations.filter((reservation) => reservation.minAsked > 0);
  return {
    status: reservations.some((reservation) => reservation.status === 'degraded')
      ? 'degraded'
      : reservations.length
        ? 'pending'
        : 'not_required',
    reservations,
  };
};

const extractJsonObject = (text = '') => {
  const fenced = String(text || '').match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const source = fenced?.[1] || String(text || '');
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  return JSON.parse(start >= 0 && end > start ? source.slice(start, end + 1) : source);
};

const categoryAllowedForFocus = (category = '', focusArea = 'combined') => {
  const focus = normalizeKey(focusArea).replace('behavioral', 'behavioural');
  const normalizedCategory = normalizeKey(category).replace('behavioral', 'behavioural');
  if (focus === 'technical') return normalizedCategory !== 'behavioural';
  if (focus === 'behavioural') return normalizedCategory !== 'technical';
  return true;
};

export const buildPreparationGoals = ({ analysisResult = {}, items = [] } = {}) => {
  const hints = analysisResult?.matchingDetails?.questionPlanHints || {};
  const values = [
    ...ensureArray(hints.priorityTopics).map((value) => ({ value, category: 'technical' })),
    ...ensureArray(hints.mustProbeSkills).map((value) => ({ value, category: 'technical' })),
    ...ensureArray(hints.mustProbeBehavioural).map((value) => ({ value, category: 'behavioural' })),
    ...ensureArray(analysisResult.requirementChecks).map((value) => ({ value, category: value?.category })),
    ...ensureArray(analysisResult.gaps || analysisResult?.explanation?.gaps).map((value) => ({ value, category: value?.category })),
  ];
  const existingKeys = new Set(ensureArray(items).map((item) => (
    item.assessmentKey || buildAssessmentKey({ ...item, turnKind: 'root_question' })
  )));
  const goals = new Map();
  values.forEach(({ value, category: categoryHint }) => {
    const topic = normalizeText(typeof value === 'string'
      ? value
      : value?.requirement || value?.label || value?.skill || value?.topic || value?.summary);
    if (!topic) return;
    const categoryKey = normalizeKey(categoryHint || (typeof value === 'object' ? value?.category : ''));
    const category = categoryKey.includes('behaviour') || categoryKey.includes('behavior')
      ? 'behavioural'
      : 'technical';
    const questionFamily = category === 'behavioural' ? 'behavioural' : 'role_specific';
    const assessmentKey = buildAssessmentKey({ topic, questionFamily, turnKind: 'root_question' });
    if (existingKeys.has(assessmentKey)) return;
    const id = `goal-${normalizeKey(topic).replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
    if (!goals.has(id)) goals.set(id, { id, topic, category, evidence: [value] });
  });
  return [...goals.values()];
};

export const generateBoundedReserveQuestions = async ({
  userId,
  sessionId,
  settings = {},
  unmetGoals = [],
  limit = MAX_RESERVE_QUESTIONS,
  callModel = callDeepSeek,
} = {}) => {
  const boundedGoals = ensureArray(unmetGoals).slice(0, 12);
  if (!boundedGoals.length || limit <= 0) return [];
  const prompt = `Return strict JSON only with this shape: {"questions":[{"goalId":"allowed goal ID","text":"one grounded interview question","category":"technical or behavioural"}]}.
Generate at most ${Math.min(MAX_RESERVE_QUESTIONS, limit)} questions. Use only the supplied goal IDs. Do not invent facts or combine goals. Ask one clear question per item.
Allowed goals: ${JSON.stringify(boundedGoals)}`;
  const { content } = await callModel(
    prompt,
    'You generate bounded preparation-stage interview reserve questions. Return strict JSON only.',
    {
      usageMetadata: {
        userId,
        sessionId,
        stage: 'cv_jd_match',
        operation: 'llm_json',
        feature: 'bounded_question_reserve',
      },
    },
  );
  const parsed = extractJsonObject(content);
  const goalsById = new Map(boundedGoals.map((goal) => [goal.id, goal]));

  return ensureArray(parsed.questions)
    .filter((question) => {
      const goal = goalsById.get(question?.goalId);
      const generatedCategory = normalizeKey(question?.category || goal?.category).replace('behavioral', 'behavioural');
      const goalCategory = normalizeKey(goal?.category).replace('behavioral', 'behavioural');
      return goal
        && normalizeText(question.text)
        && generatedCategory === goalCategory
        && categoryAllowedForFocus(generatedCategory, settings.focusArea || settings.questionType);
    })
    .slice(0, Math.min(MAX_RESERVE_QUESTIONS, limit))
    .map((question) => {
      const goal = goalsById.get(question.goalId);
      const category = question.category || goal.category || 'technical';
      return {
        userId,
        sessionId,
        questionId: stableQuestionId('poolq', [sessionId, 'preparation_reserve', question.goalId, question.text]),
        questionRole: 'root_question',
        topic: goal.topic,
        category,
        stage: category,
        questionFamily: category === 'behavioural' ? 'behavioural' : 'role_specific',
        questionIntent: 'validate_unmet_goal',
        text: normalizeText(question.text),
        fallbackText: normalizeText(question.text),
        linkedJdRequirement: ensureArray(goal.evidence),
        expectedSignal: ['grounded_evidence', 'personal_action', 'validation'],
        evidenceNeed: ['grounded_evidence', 'personal_action', 'validation'],
        modeCompatibility: buildModeCompatibility(category),
        metadata: { preparationGoalId: goal.id },
      };
    });
};

const isRootQuestion = (item = {}) => (
  !item.questionRole
  || item.questionRole === 'root_question'
  || item.turnKind === 'root_question'
);

const normalizeRootQuestion = (item = {}) => ({
  ...item,
  turnKind: 'root_question',
  assessmentKey: item.assessmentKey || buildAssessmentKey({ ...item, turnKind: 'root_question' }),
  questionFingerprint: item.questionFingerprint || buildQuestionFingerprint(item.text || item.fallbackText),
});

const buildRequiredUniqueRootCount = (settings = {}) => {
  const config = resolveInterviewModeConfig(settings);
  const freshRootSlots = config.freshTurnAnchors.filter((turn) => turn <= config.totalQuestions).length;
  return Math.min(config.totalQuestions, freshRootSlots + RESERVE_BUFFER_SIZE);
};

export const assessQuestionPoolReadiness = ({ items = [], settings = {}, proofStrategy = null } = {}) => {
  const requiredUniqueRootCount = buildRequiredUniqueRootCount(settings);
  const uniqueRootAssessmentKeys = new Set(
    items
      .filter(isRootQuestion)
      .map(normalizeRootQuestion)
      .map((item) => item.assessmentKey),
  );
  const uniqueRootCount = uniqueRootAssessmentKeys.size;
  const hasProofStrategy = Boolean(proofStrategy && Object.keys(proofStrategy).length);
  const proofCoverage = hasProofStrategy
    ? assessProofStrategyQuestionCoverage({ proofStrategy, poolItems: items })
    : { representedCoverageIds: [], unresolvedCoverageIds: [] };
  const proofStrategyDegraded = hasProofStrategy && proofStrategy.artifactStatus !== 'ready';
  const hasUnrepresentedCoverage = proofCoverage.unresolvedCoverageIds.length > 0;
  const hasEnoughUniqueQuestions = uniqueRootCount >= requiredUniqueRootCount;
  const ready = hasEnoughUniqueQuestions && !proofStrategyDegraded && !hasUnrepresentedCoverage;
  const degradedReason = !hasEnoughUniqueQuestions
    ? 'insufficient_unique_prepared_questions'
    : proofStrategyDegraded
      ? proofStrategy.degradedReason || 'proof_strategy_degraded'
      : hasUnrepresentedCoverage ? 'unrepresented_must_cover_contracts' : null;

  return {
    status: ready ? 'ready' : 'degraded',
    readiness: ready ? 'ready' : 'degraded',
    degradedReason,
    requiredUniqueRootCount,
    uniqueRootCount,
    ...proofCoverage,
  };
};

const buildPreparedHistory = (items = []) => buildQuestionHistory(
  items.filter(isRootQuestion).map((item) => ({
    role: 'ai',
    text: item.text || item.fallbackText,
    questionId: item.questionId,
    metadata: {
      ...item,
      turnKind: 'root_question',
      turnType: 'interview_question',
      countsAsQuestion: true,
    },
  })),
);

const normalizeReserveQuestion = (item = {}) => ({
  ...normalizeRootQuestion(item),
  schemaVersion: 'v3',
  sourceStage: 'preparation_reserve',
  sourceType: 'bounded_llm_reserve',
  generationMethod: 'bounded_llm',
  status: 'active',
  coverageContractIds: [],
  testedRoleIntentIds: [],
  recommendedEvidenceIds: [],
});

const loadPersistedProofStrategy = async (sessionId) => {
  if (!sessionId) return null;
  const plan = await InterviewPlan.findOne({ sessionId }).select({ 'roleFit.proofStrategy': 1 }).lean();
  return plan?.roleFit?.proofStrategy || null;
};

export const prepareInterviewQuestionPool = async ({
  settings = {},
  deliveryMode = 'text',
  composePool = composeInterviewQuestionPool,
  loadCatalogItems = loadApprovedQuestionCatalogItems,
  generateReserveQuestions = null,
  persistReserveQuestions = null,
  proofStrategy = null,
  loadProofStrategy = loadPersistedProofStrategy,
  ...context
} = {}) => {
  let catalogLoad = { status: 'not_applicable', items: [] };
  if (isVoiceDeliveryMode(deliveryMode)) {
    catalogLoad = { status: 'catalog_unavailable', items: [] };
    try {
      catalogLoad = await loadCatalogItems({
        analysisResult: context.analysisResult,
        settings,
      }) || catalogLoad;
    } catch (error) {
      catalogLoad = {
        status: 'catalog_unavailable',
        items: [],
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
  const items = await composePool({
    settings,
    deliveryMode,
    catalogItems: ensureArray(catalogLoad.items),
    ...context,
  });
  const catalogCoverage = buildCatalogPreparationCoverage({
    deliveryMode,
    catalogLoad,
    items,
    settings,
    analysisResult: context.analysisResult,
  });
  const resolvedProofStrategy = proofStrategy
    || (context.sessionId ? await loadProofStrategy(context.sessionId) : null);
  const initialReadiness = assessQuestionPoolReadiness({ items, settings, proofStrategy: resolvedProofStrategy });
  const needsCapacityReserve = initialReadiness.uniqueRootCount < initialReadiness.requiredUniqueRootCount;
  if (initialReadiness.status === 'ready' || !needsCapacityReserve) {
    return {
      items,
      readiness: initialReadiness,
      rejectedReserveQuestions: [],
      reserveGenerationError: null,
      catalogStatus: catalogLoad.status || 'catalog_unavailable',
      catalogLoadError: catalogLoad.error || null,
      catalogCoverage,
    };
  }

  const limit = Math.min(
    MAX_RESERVE_QUESTIONS,
    initialReadiness.requiredUniqueRootCount - initialReadiness.uniqueRootCount,
  );

  try {
    const reserveGenerator = generateReserveQuestions || ((generationContext) => generateBoundedReserveQuestions({
      ...generationContext,
      unmetGoals: buildPreparationGoals(generationContext),
    }));
    const generated = await reserveGenerator({
      settings,
      items,
      readiness: initialReadiness,
      limit,
      ...context,
    });
    const normalized = generated.slice(0, MAX_RESERVE_QUESTIONS).map(normalizeReserveQuestion);
    const novelty = filterNovelQuestionCandidates({
      candidates: normalized,
      history: buildPreparedHistory(items),
    });
    const accepted = novelty.accepted.slice(0, limit);
    const reservePersister = persistReserveQuestions || (async (reserveItems) => {
      await InterviewQuestionPoolItem.insertMany(reserveItems, { ordered: false });
      const questionIds = reserveItems.map((item) => item.questionId);
      return InterviewQuestionPoolItem.find({ sessionId: context.sessionId, questionId: { $in: questionIds } }).lean();
    });
    const persisted = accepted.length > 0 ? await reservePersister(accepted) : [];
    const preparedItems = [...items, ...(persisted || accepted)];

    return {
      items: preparedItems,
      readiness: assessQuestionPoolReadiness({
        items: preparedItems,
        settings,
        proofStrategy: resolvedProofStrategy,
      }),
      rejectedReserveQuestions: novelty.rejected,
      reserveGenerationError: null,
      catalogStatus: catalogLoad.status || 'catalog_unavailable',
      catalogLoadError: catalogLoad.error || null,
      catalogCoverage,
    };
  } catch (error) {
    return {
      items,
      readiness: initialReadiness,
      rejectedReserveQuestions: [],
      reserveGenerationError: error instanceof Error ? error.message : String(error),
      catalogStatus: catalogLoad.status || 'catalog_unavailable',
      catalogLoadError: catalogLoad.error || null,
      catalogCoverage,
    };
  }
};
