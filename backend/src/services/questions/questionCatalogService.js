import { ensureArray, normalizeKey } from '../../utils/commonHelpers.js';
import { AI_DELIVERY_SIGNAL_TAXONOMY, ML_SIGNAL_ALIASES, QUESTION_CATALOG_VERSION } from '../../data/questionCatalogSeed2026_1.js';
import {
  buildQuestionCatalogGovernanceDigest,
  QUESTION_CATALOG_GOVERNANCE_SCOPE,
} from '../../data/questionCatalogReview2026_1.js';

const LIFECYCLES = new Set(['draft', 'approved', 'deprecated', 'disabled']);
const REVIEW_DECISIONS = new Set(['pending', 'approved', 'revise', 'blocked', 'deferred']);
const FORBIDDEN_KEYS = new Set([
  'userid',
  'sessionid',
  'candidatename',
  'cvtext',
  'cvprofile',
  'resumetext',
  'jdtext',
  'rawjd',
  'rawjobdescription',
  'transcript',
  'reporttext',
  'rawreasoning',
  'chainofthought',
]);

const normalizeSignalText = (value = '') => normalizeKey(String(value || '').replace(/[^a-z0-9+#.]+/gi, ' '));
const uniqueNormalizedValues = (values = []) => [...new Set(ensureArray(values).map(normalizeKey).filter(Boolean))];
const isAiOrMlCatalogItem = (item = {}) => (
  normalizeKey(item.questionType).startsWith('ai_') || normalizeKey(item.questionType).startsWith('ml_')
);

const hasForbiddenCatalogField = (value) => {
  if (Array.isArray(value)) return value.some(hasForbiddenCatalogField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nestedValue]) => (
    FORBIDDEN_KEYS.has(normalizeKey(key).replace(/[^a-z0-9]+/g, '')) || hasForbiddenCatalogField(nestedValue)
  ));
};

export const validateQuestionCatalogItem = (item = {}) => {
  const errors = [];
  if (!normalizeKey(item.catalogQuestionId)) errors.push('missing_catalog_question_id');
  if (!normalizeKey(item.catalogVersion)) errors.push('missing_catalog_version');
  if (!LIFECYCLES.has(item.lifecycle)) errors.push('invalid_lifecycle');
  if (!normalizeKey(item.questionFamily)) errors.push('missing_question_family');
  if (!normalizeKey(item.questionType)) errors.push('missing_question_type');
  if (!ensureArray(item.targetLevels).length) errors.push('missing_target_levels');
  if (!ensureArray(item.promptVariants).some((variant) => String(variant?.text || '').trim())) errors.push('missing_prompt_variant');
  if (!ensureArray(item.expectedSignals).length) errors.push('missing_expected_signals');
  if (!item.roleEligibility || typeof item.roleEligibility !== 'object') errors.push('missing_role_eligibility');
  if (isAiOrMlCatalogItem(item)) {
    const coveredLevels = new Set(ensureArray(item.promptVariants).flatMap((variant) => ensureArray(variant?.targetLevels).map(normalizeKey)));
    if (!['junior', 'intermediate', 'senior'].every((level) => coveredLevels.has(level))) errors.push('missing_ai_ml_level_variants');
    if (!ensureArray(item.notEligibleExamples).some((example) => String(example || '').trim())) errors.push('missing_not_eligible_example');
    if (!String(item.researchBasis?.reviewedAt || '').trim()) errors.push('missing_research_review_date');
    if (ensureArray(item.researchBasis?.sources).filter((source) => /^https:\/\//.test(String(source || ''))).length < 2) {
      errors.push('insufficient_research_sources');
    }
  }
  if (hasForbiddenCatalogField(item)) errors.push('contains_candidate_or_session_field');
  return { valid: errors.length === 0, errors };
};

export const validateQuestionCatalogSeed = (items = [], { catalogVersion } = {}) => {
  const ids = new Set();
  const errors = [];
  const expectedVersion = catalogVersion || items[0]?.catalogVersion || QUESTION_CATALOG_VERSION;
  ensureArray(items).forEach((item) => {
    const validation = validateQuestionCatalogItem(item);
    validation.errors.forEach((error) => errors.push(`${item?.catalogQuestionId || 'unknown'}:${error}`));
    if (ids.has(item?.catalogQuestionId)) errors.push(`${item?.catalogQuestionId}:duplicate_catalog_question_id`);
    ids.add(item?.catalogQuestionId);
    if (item?.catalogVersion !== expectedVersion) errors.push(`${item?.catalogQuestionId}:unexpected_catalog_version`);
  });
  return { valid: errors.length === 0, errors };
};

export const validateQuestionCatalogReview = ({
  reviewRecord = {},
  catalogItems = [],
  aiDeliverySignalTaxonomy = AI_DELIVERY_SIGNAL_TAXONOMY,
  mlSignalAliases = ML_SIGNAL_ALIASES,
  catalogVersion,
} = {}) => {
  const errors = [];
  const catalogQuestionIds = uniqueNormalizedValues(ensureArray(catalogItems).map((item) => item?.catalogQuestionId));
  const reviewedCatalogQuestionIds = uniqueNormalizedValues(reviewRecord.reviewedCatalogQuestionIds);
  const governanceScope = uniqueNormalizedValues(reviewRecord.governanceScope);
  const decision = normalizeKey(reviewRecord.decision);
  const expectedVersion = catalogVersion || reviewRecord.catalogVersion || catalogItems[0]?.catalogVersion || QUESTION_CATALOG_VERSION;
  if (reviewRecord.catalogVersion !== expectedVersion) errors.push('catalog_review_version_mismatch');
  if (!REVIEW_DECISIONS.has(decision)) errors.push('invalid_catalog_review_decision');
  if (decision !== 'approved') errors.push('catalog_review_not_approved');
  if (!normalizeKey(reviewRecord.reviewer)) errors.push('missing_catalog_reviewer');
  if (!String(reviewRecord.decidedAt || '').trim() || Number.isNaN(Date.parse(reviewRecord.decidedAt))) errors.push('missing_catalog_review_date');
  if (!String(reviewRecord.decisionReason || '').trim()) errors.push('missing_catalog_review_reason');
  if (
    reviewedCatalogQuestionIds.length !== catalogQuestionIds.length
    || reviewedCatalogQuestionIds.some((id) => !catalogQuestionIds.includes(id))
  ) {
    errors.push('catalog_review_question_set_incomplete');
  }
  const currentGovernanceDigest = buildQuestionCatalogGovernanceDigest({
    catalogItems,
    aiDeliverySignalTaxonomy,
    mlSignalAliases,
  });
  if (
    governanceScope.length !== QUESTION_CATALOG_GOVERNANCE_SCOPE.length
    || governanceScope.some((scope) => !QUESTION_CATALOG_GOVERNANCE_SCOPE.includes(scope))
  ) {
    errors.push('catalog_review_governance_scope_incomplete');
  }
  if (reviewRecord.candidateCatalogDigest !== currentGovernanceDigest) {
    errors.push('catalog_review_candidate_digest_mismatch');
  }
  if (reviewRecord.approvedCatalogDigest !== currentGovernanceDigest) {
    errors.push('catalog_review_digest_mismatch');
  }
  if (reviewRecord.approvedCatalogDigest !== reviewRecord.candidateCatalogDigest) {
    errors.push('catalog_review_approved_digest_mismatch');
  }
  if (hasForbiddenCatalogField(reviewRecord)) errors.push('catalog_review_contains_candidate_or_session_field');
  return { valid: errors.length === 0, errors };
};

const strengthRank = { none: 0, weak: 1, medium: 2, strong: 3 };

export const resolveAiDeliverySignalProfile = ({ text = '', taxonomy = AI_DELIVERY_SIGNAL_TAXONOMY } = {}) => {
  const normalizedText = normalizeSignalText(text);
  const matchedSignals = ensureArray(taxonomy)
    .filter((entry) => entry.lifecycle === 'active')
    .map((entry) => ({
      ...entry,
      matchedAliases: ensureArray(entry.aliases).filter((alias) => normalizedText.includes(normalizeSignalText(alias))),
    }))
    .filter((entry) => entry.matchedAliases.length > 0)
    .map(({ aliases: _aliases, ...entry }) => entry);
  const mediumFamilies = new Set(matchedSignals.filter((entry) => entry.strength === 'medium').map((entry) => entry.signalFamily));
  const strongestSignal = matchedSignals.reduce((strongest, entry) => (
    strengthRank[entry.strength] > strengthRank[strongest] ? entry.strength : strongest
  ), 'none');
  const hasMlSignal = ML_SIGNAL_ALIASES.some((alias) => normalizedText.includes(normalizeSignalText(alias)));

  return {
    matchedSignals,
    strongestSignal,
    mediumSignalFamilies: [...mediumFamilies],
    explicitAiDelivery: strongestSignal === 'strong' || mediumFamilies.size >= 2,
    hasMlSignal,
  };
};

export const buildQuestionCatalogSeedUpserts = (items = []) => {
  const validation = validateQuestionCatalogSeed(items);
  if (!validation.valid) throw new Error(`Invalid question catalog seed: ${validation.errors.join(', ')}`);
  return ensureArray(items).map((item) => ({
    updateOne: {
      filter: { catalogQuestionId: item.catalogQuestionId, catalogVersion: item.catalogVersion },
      update: { $setOnInsert: { ...item, seedSource: 'question_catalog_seed' } },
      upsert: true,
    },
  }));
};
