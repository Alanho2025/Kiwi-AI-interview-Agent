import { InterviewQuestionPoolItem } from '../../db/models/interviewQuestionPoolItemModel.js';
import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';
import { buildQuestionPoolFromAnalysis } from '../session/sessionShared.js';
import { validatePreparedQuestionPool } from '../schemaValidationService.js';
import { getCvQuestionSeeds } from './cvQuestionSeedService.js';
import { getJdQuestionFilter } from './jdQuestionFilterService.js';
import {
  buildModeCompatibility,
  clampWeight,
  normalizeCategory,
  normalizeTopicKey,
  questionRetentionDate,
  stableQuestionId,
} from './questionArtifactHelpers.js';

const sourcePriority = {
  match_gap: 6,
  match_validation: 5,
  jd_filter: 4,
  jd_requirement: 4,
  cv_seed: 3,
  common_template: 2,
  fallback: 1,
};

const resolveRoleDomain = (analysisResult = {}) => analysisResult?.parsedJdProfile?.universalRoleProfile?.roleDomain
  || analysisResult?.parsedJdProfile?.roleDomain
  || analysisResult?.parsedJdProfile?.metadata?.universalRoleProfile?.roleDomain
  || analysisResult?.matchingDetails?.rubric?.universalRoleProfile?.roleDomain
  || analysisResult?.scoreBreakdown?.semanticDimensions?.roleDomain
  || 'general';

const resolveQuestionFamily = ({ category = '', questionIntent = '', questionFamily = '' } = {}) => {
  if (questionFamily) return questionFamily;
  const normalizedCategory = normalizeCategory(category);
  const normalizedIntent = normalizeKey(questionIntent);
  if (normalizedCategory === 'behavioural' || normalizedIntent.includes('behaviour')) return 'behavioural';
  if (normalizedCategory === 'opening' || normalizedIntent.includes('self_intro')) return 'self_intro';
  if (normalizedCategory === 'motivation' || normalizedIntent.includes('motivation')) return 'motivation';
  if (normalizedCategory === 'closing') return 'conversation';
  return 'role_specific';
};

const resolveEvidenceMode = ({ capabilityGroup = '', questionIntent = '', text = '', evidenceMode = '' } = {}) => {
  if (evidenceMode) return evidenceMode;
  if (capabilityGroup === 'professional_credential') return 'credential_verification';
  const normalizedIntent = normalizeKey(questionIntent);
  const normalizedText = normalizeKey(text);
  if (normalizedIntent.includes('scenario') || /\b(if|would|suppose|imagine)\b/.test(normalizedText)) return 'scenario_reasoning';
  if (normalizedIntent.includes('knowledge') || /\b(explain|principle|standard|framework)\b/.test(normalizedText)) return 'knowledge_explanation';
  return 'past_example';
};

const resolveQuestionRole = ({ sourceStage = '', category = '', stage = '', questionRole = '' } = {}) => {
  if (['root_question', 'fallback_root', 'wrap_up'].includes(questionRole)) return questionRole;
  const normalizedCategory = normalizeCategory(category || stage);
  if (sourceStage === 'fallback') return 'fallback_root';
  if (['closing'].includes(normalizedCategory) || ['closing', 'wrap_up'].includes(stage)) return 'wrap_up';
  return 'root_question';
};

const resolveFollowUpStrategies = ({ followUpStrategies = [], followUpStrategy = '', questionIntent = '', evidenceNeed = [] } = {}) => {
  const explicit = ensureArray(followUpStrategies).filter(Boolean);
  if (explicit.length) return explicit;
  if (followUpStrategy) return [followUpStrategy];
  const needs = ensureArray(evidenceNeed);
  if (needs.includes('personal_ownership')) return ['ownership', 'technical_depth'];
  if (needs.includes('tradeoff')) return ['tradeoff', 'validation'];
  if (needs.includes('result_or_impact')) return ['result', 'reflection'];
  if (questionIntent === 'behavioural_star') return ['behavioural_action', 'result', 'reflection'];
  return ['ownership', 'validation', 'result'];
};

const buildBaseItem = ({
  userId,
  sessionId,
  cvFileId,
  matchAnalysisId,
  jdFingerprint,
  sourceStage,
  sourceType,
  category,
  stage,
  topic,
  questionIntent,
  questionRole = '',
  maxFollowUps = 2,
  text,
  fallbackText = '',
  priorityWeight = 0.5,
  coverageWeight = 0.5,
  riskWeight = 0.4,
  metadata = {},
  ...rest
}) => {
  const questionFamily = resolveQuestionFamily({ category, questionIntent, questionFamily: rest.questionFamily });
  const evidenceMode = resolveEvidenceMode({
    capabilityGroup: rest.capabilityGroup,
    questionIntent,
    text,
    evidenceMode: rest.evidenceMode,
  });
  return {
    userId,
    sessionId,
    matchAnalysisId,
    cvFileId,
    jdFingerprint,
    questionId: stableQuestionId('poolq', [sessionId, sourceStage, sourceType, category, topic, questionIntent, text]),
    schemaVersion: 'v2',
    sourceStage,
    questionRole: resolveQuestionRole({ sourceStage, category, stage, questionRole }),
    maxFollowUps: Math.max(0, Number.isFinite(Number(maxFollowUps)) ? Number(maxFollowUps) : 2),
    followUpStrategies: resolveFollowUpStrategies({
      followUpStrategies: rest.followUpStrategies,
      followUpStrategy: rest.followUpStrategy,
      questionIntent,
      evidenceNeed: rest.evidenceNeed || rest.expectedSignal,
    }),
    sourceType,
    category: normalizeCategory(category),
    stage: stage || normalizeCategory(category),
    topic: normalizeText(topic) || 'role_fit',
    competency: normalizeText(rest.competency || topic),
    questionIntent: questionIntent || 'collect_specific_example',
    text,
    fallbackText: fallbackText || text,
    spokenDraft: fallbackText || text,
    expectedSignal: ensureArray(rest.expectedSignal),
    evidenceNeed: ensureArray(rest.evidenceNeed || rest.expectedSignal),
    constraints: ensureArray(rest.constraints),
    followUpStrategy: rest.followUpStrategy || '',
    priorityWeight: clampWeight(priorityWeight),
    coverageWeight: clampWeight(coverageWeight),
    riskWeight: clampWeight(riskWeight),
    modeCompatibility: rest.modeCompatibility || buildModeCompatibility(category),
    status: 'active',
    generationMethod: rest.generationMethod || 'deterministic',
    metadata,
    questionFamily,
    evidenceMode,
    roleDomain: rest.roleDomain || 'general',
    requirementCategory: rest.requirementCategory || '',
    capabilityGroup: rest.capabilityGroup || '',
    retentionUntil: questionRetentionDate(),
    ...rest,
  };
};

const mapLegacyQuestion = (question, context, index) => buildBaseItem({
  ...context,
  sourceStage: ['opening', 'motivation', 'closing', 'wrap_up'].includes(normalizeCategory(question.category || question.stage)) ? 'common_template' : 'legacy_plan',
  sourceType: question.sourceType || 'common_template',
  category: question.category || question.stage,
  stage: question.stage,
  topic: question.topic || question.matchedSkill || 'role_fit',
  questionIntent: question.questionIntent || question.type || 'legacy_question',
  text: question.text || question.fallbackText,
  fallbackText: question.fallbackText || question.text,
  priorityWeight: question.priorityWeight ?? question.confidence ?? 0.55,
  coverageWeight: question.coverageWeight ?? 0.55,
  riskWeight: question.riskWeight ?? 0.35,
  linkedCvEvidence: question.linkedCvEvidence || question.cvEvidenceRefs || [],
  linkedJdRequirement: question.linkedJdRequirement || [],
  requirementId: question.requirementId || question.matchedRequirementId || '',
  expectedSignal: question.expectedSignal || question.evidenceNeed || [],
  evidenceNeed: question.evidenceNeed || question.expectedSignal || [],
  metadata: { legacyQuestion: question, order: index },
});

const mapSeedQuestion = (seed, decision, context) => {
  const adaptedText = decision?.adaptedQuestionText || seed.draftQuestion || seed.fallbackText;
  return buildBaseItem({
    ...context,
    sourceStage: decision?.decision === 'adapt' ? 'jd_filter' : 'cv_seed',
    sourceSeedId: seed.seedId,
    sourceType: seed.sourceType || 'cv_template',
    category: seed.category,
    stage: seed.category,
    topic: seed.topic,
    competency: seed.competency,
    questionIntent: seed.questionIntent,
    text: adaptedText,
    fallbackText: adaptedText,
    linkedCvEvidence: seed.evidenceRefs || [],
    expectedSignal: seed.expectedSignal || [],
    evidenceNeed: seed.expectedSignal || [],
    priorityWeight: clampWeight((seed.priorityWeight || 0.5) + (decision?.scoreDelta || 0)),
    coverageWeight: decision?.decision === 'boost' || decision?.decision === 'adapt' ? 0.78 : 0.55,
    riskWeight: ensureArray(seed.riskTags).length ? 0.75 : 0.4,
    generationMethod: seed.generationMethod || 'deterministic',
    metadata: { filterDecision: decision || null, evidenceSummary: seed.evidenceSummary },
  });
};

const buildRequirementItems = (analysisResult, context) => ensureArray(analysisResult?.requirementChecks)
  .filter((item) => item?.requirement || item?.label || item?.skill)
  .slice(0, 6)
  .map((requirement) => {
    const topic = requirement.requirement || requirement.label || requirement.skill;
    return buildBaseItem({
      ...context,
      sourceStage: 'match_validation',
      sourceType: 'jd_requirement',
      category: normalizeKey(requirement.category).includes('behaviour') ? 'behavioural' : 'technical',
      stage: 'role_requirement',
      topic,
      questionIntent: 'validate_requirement',
      text: `Tell me about one example that shows your evidence for ${topic}. What did you personally do, and what was the result?`,
      linkedJdRequirement: [requirement],
      requirementId: requirement.requirementId || requirement.id || normalizeKey(topic),
      roleDomain: requirement.roleDomain || resolveRoleDomain(analysisResult),
      requirementCategory: requirement.category || '',
      capabilityGroup: requirement.capabilityGroup || '',
      expectedSignal: ['direct_evidence', 'personal_action', 'result_or_impact'],
      priorityWeight: requirement.met === false ? 0.82 : 0.64,
      coverageWeight: 0.78,
      riskWeight: requirement.met === false ? 0.85 : 0.5,
    });
  });

const buildGapItems = (analysisResult, context) => ensureArray(analysisResult?.gaps || analysisResult?.explanation?.gaps)
  .filter(Boolean)
  .slice(0, 5)
  .map((gap) => {
    const topic = typeof gap === 'string' ? gap : gap.topic || gap.label || gap.summary || 'match gap';
    return buildBaseItem({
      ...context,
      sourceStage: 'match_gap',
      sourceType: 'match_gap',
      category: 'technical',
      stage: 'validation',
      topic,
      questionIntent: 'risk_probe',
      text: `I want to validate one possible gap around ${topic}. What related experience do you have, and what did you personally own?`,
      matchGapId: typeof gap === 'string' ? normalizeKey(gap) : gap.id || normalizeKey(topic),
      roleDomain: resolveRoleDomain(analysisResult),
      requirementCategory: typeof gap === 'string' ? '' : gap.category || '',
      capabilityGroup: typeof gap === 'string' ? '' : gap.capabilityGroup || '',
      expectedSignal: ['gap_validation', 'adjacent_experience', 'ownership'],
      priorityWeight: 0.8,
      coverageWeight: 0.82,
      riskWeight: 0.9,
      metadata: { gap },
    });
  });

const dedupePool = (items = []) => {
  const byKey = new Map();
  for (const item of items) {
    if (!normalizeText(item.text || item.fallbackText)) continue;
    const key = [normalizeTopicKey(item.topic), normalizeCategory(item.category), normalizeKey(item.questionIntent)].join(':');
    const existing = byKey.get(key);
    if (!existing || (sourcePriority[item.sourceStage] || 0) > (sourcePriority[existing.sourceStage] || 0)) {
      byKey.set(key, item);
    }
  }
  return [...byKey.values()];
};

export const ensureMinimumFallbacks = (items, context) => {
  const hasTechnical = items.some((item) => ['technical', 'role_competency'].includes(item.category));
  const hasBehavioural = items.some((item) => item.category === 'behavioural');
  const additions = [];
  if (!hasTechnical) {
    additions.push(buildBaseItem({
      ...context,
      sourceStage: 'fallback',
      sourceType: 'fallback',
      category: 'technical',
      stage: 'technical',
      topic: 'role_specific_competency',
      questionIntent: 'validate_depth',
      text: 'Tell me about one role-specific task you handled yourself. What approach and professional judgement did you use, what risks or quality requirements mattered, and how did you validate the outcome?',
      expectedSignal: ['approach', 'judgement', 'risk_or_quality', 'validation', 'outcome'],
      priorityWeight: 0.45,
    }));
  }
  if (!hasBehavioural) {
    additions.push(buildBaseItem({
      ...context,
      sourceStage: 'fallback',
      sourceType: 'fallback',
      category: 'behavioural',
      stage: 'behavioural',
      topic: 'teamwork',
      questionIntent: 'behavioural_star',
      text: 'Tell me about a time you worked through a challenge with others. What did you do, and what was the outcome?',
      expectedSignal: ['situation', 'personal_action', 'result_or_impact'],
      priorityWeight: 0.45,
    }));
  }
  return [...items, ...additions];
};

export const buildInterviewQuestionPoolItems = ({ userId, sessionId, cvFileId = null, matchAnalysisId = null, jdFingerprint = '', analysisResult = {}, settings = {}, cvSeeds = [], jdFilter = null } = {}) => {
  const context = {
    userId,
    sessionId,
    cvFileId,
    matchAnalysisId,
    jdFingerprint,
    roleDomain: resolveRoleDomain(analysisResult),
  };
  const legacyItems = buildQuestionPoolFromAnalysis(analysisResult, settings)
    .map((question, index) => mapLegacyQuestion(question, context, index));
  const decisionsBySeedId = new Map(ensureArray(jdFilter?.filterDecisions).map((decision) => [decision.seedId, decision]));
  const seedItems = ensureArray(cvSeeds)
    .filter((seed) => decisionsBySeedId.get(seed.seedId)?.decision !== 'suppress')
    .map((seed) => mapSeedQuestion(seed, decisionsBySeedId.get(seed.seedId), context));
  const requirementItems = buildRequirementItems(analysisResult, context);
  const gapItems = buildGapItems(analysisResult, context);
  const deduped = dedupePool([...legacyItems, ...requirementItems, ...seedItems, ...gapItems]);
  return validatePreparedQuestionPool(ensureMinimumFallbacks(deduped, context));
};

export const composeInterviewQuestionPool = async ({ userId, sessionId, cvFileId = null, matchAnalysisId = null, jdFingerprint = '', analysisResult = {}, settings = {} } = {}) => {
  if (!userId || !sessionId) return [];
  const [cvSeeds, jdFilter] = await Promise.all([
    cvFileId ? getCvQuestionSeeds({ userId, cvFileId, status: 'active' }) : Promise.resolve([]),
    getJdQuestionFilter({ userId, matchAnalysisId, jdFingerprint }),
  ]);
  const items = buildInterviewQuestionPoolItems({
    userId,
    sessionId,
    cvFileId,
    matchAnalysisId,
    jdFingerprint,
    analysisResult,
    settings,
    cvSeeds,
    jdFilter,
  });
  await InterviewQuestionPoolItem.deleteMany({ sessionId });
  if (!items.length) return [];
  await InterviewQuestionPoolItem.insertMany(items, { ordered: false });
  return InterviewQuestionPoolItem.find({ sessionId }).sort({ priorityWeight: -1, createdAt: 1 }).lean();
};

export const buildPreparedRootQuestionPoolQuery = ({ sessionId, category = null, status = 'active' } = {}) => {
  const query = { sessionId };
  if (status) query.status = status;
  if (category) query.category = normalizeCategory(category);
  query.$or = [
    { questionRole: 'root_question' },
    { questionRole: { $exists: false } },
    { questionRole: null },
    { questionRole: '' },
  ];
  return query;
};

export const getPreparedQuestionPool = async ({ sessionId, category = null, status = 'active' } = {}) => {
  if (!sessionId) return [];
  const query = buildPreparedRootQuestionPoolQuery({ sessionId, category, status });
  return InterviewQuestionPoolItem.find(query).sort({ priorityWeight: -1, createdAt: 1 }).lean();
};

export const markQuestionPoolItemAsked = async ({ sessionId, questionId, askedTurnIndex, rankTrace = {} } = {}) => {
  if (!sessionId || !questionId) return null;
  return InterviewQuestionPoolItem.findOneAndUpdate(
    { sessionId, questionId },
    {
      status: 'asked',
      askedAt: new Date(),
      askedTurnIndex,
      lastRankScore: rankTrace?.score ?? null,
      rankTrace,
    },
    { new: true }
  ).lean();
};
