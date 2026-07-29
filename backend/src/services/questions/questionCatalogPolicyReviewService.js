import { buildCanonicalSha256Digest } from '../../data/questionCatalogReview2026_1.js';
import { ensureArray, normalizeKey } from '../../utils/commonHelpers.js';
import { buildVoiceSelectionPolicyReviewSnapshot } from './questionCatalogPolicyReviewDocumentService.js';

export const QUESTION_SELECTION_POLICY_VERSION = '2026.1';
export const QUESTION_SELECTION_POLICY_SCOPE = Object.freeze([
  'role_level_question_count_matrix',
  'ai_ml_eligibility_and_coverage',
  'follow_up_vs_next_root_comparison',
]);

const REVIEW_DECISIONS = new Set(['pending', 'approved', 'revise', 'blocked', 'deferred']);
const FORBIDDEN_REVIEW_KEYS = new Set([
  'userid',
  'sessionid',
  'candidatename',
  'cvtext',
  'jdtext',
  'transcript',
  'rawreasoning',
  'chainofthought',
]);

const uniqueNormalizedValues = (values = []) => [
  ...new Set(ensureArray(values).map(normalizeKey).filter(Boolean)),
];

const hasForbiddenReviewField = (value) => {
  if (Array.isArray(value)) return value.some(hasForbiddenReviewField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value).some(([key, nestedValue]) => (
    FORBIDDEN_REVIEW_KEYS.has(normalizeKey(key).replace(/[^a-z0-9]+/g, ''))
    || hasForbiddenReviewField(nestedValue)
  ));
};

export const buildQuestionSelectionPolicyDigest = (policySnapshot = {}) => (
  buildCanonicalSha256Digest(policySnapshot)
);

const candidatePolicySnapshot = buildVoiceSelectionPolicyReviewSnapshot();
const candidatePolicyDigest = buildQuestionSelectionPolicyDigest(candidatePolicySnapshot);
const candidateScenarioIds = Object.freeze(
  candidatePolicySnapshot.scenarios.map((scenario) => scenario.scenarioId),
);

export const QUESTION_SELECTION_POLICY_REVIEW = Object.freeze({
  policyVersion: QUESTION_SELECTION_POLICY_VERSION,
  policyScope: QUESTION_SELECTION_POLICY_SCOPE,
  candidatePolicyDigest,
  approvedPolicyDigest: candidatePolicyDigest,
  decision: 'approved',
  reviewer: 'heminghan',
  decidedAt: '2026-07-28T20:19:45.000Z',
  decisionReason: 'Product Owner approved the CP2 Voice role, level, question-count, coverage, follow-up, and candidate-visibility policy.',
  candidateScenarioIds,
  reviewedScenarioIds: candidateScenarioIds,
});

export const validateQuestionSelectionPolicyReview = ({
  reviewRecord = {},
  policySnapshot = buildVoiceSelectionPolicyReviewSnapshot(),
  policyVersion,
} = {}) => {
  const errors = [];
  const decision = normalizeKey(reviewRecord.decision);
  const policyScope = uniqueNormalizedValues(reviewRecord.policyScope);
  const candidateScenarioIds = uniqueNormalizedValues(
    ensureArray(policySnapshot.scenarios).map((scenario) => scenario?.scenarioId),
  );
  const reviewedScenarioIds = uniqueNormalizedValues(reviewRecord.reviewedScenarioIds);
  const currentPolicyDigest = buildQuestionSelectionPolicyDigest(policySnapshot);
  const expectedPolicyVersion = policyVersion || reviewRecord.policyVersion || QUESTION_SELECTION_POLICY_VERSION;

  if (reviewRecord.policyVersion !== expectedPolicyVersion) {
    errors.push('selection_policy_review_version_mismatch');
  }
  if (!REVIEW_DECISIONS.has(decision)) errors.push('invalid_selection_policy_review_decision');
  if (decision !== 'approved') errors.push('selection_policy_review_not_approved');
  if (!normalizeKey(reviewRecord.reviewer)) errors.push('missing_selection_policy_reviewer');
  if (!String(reviewRecord.decidedAt || '').trim() || Number.isNaN(Date.parse(reviewRecord.decidedAt))) {
    errors.push('missing_selection_policy_review_date');
  }
  if (!String(reviewRecord.decisionReason || '').trim()) errors.push('missing_selection_policy_review_reason');
  if (
    policyScope.length !== QUESTION_SELECTION_POLICY_SCOPE.length
    || policyScope.some((scope) => !QUESTION_SELECTION_POLICY_SCOPE.includes(scope))
  ) {
    errors.push('selection_policy_review_scope_incomplete');
  }
  if (
    reviewedScenarioIds.length !== candidateScenarioIds.length
    || reviewedScenarioIds.some((scenarioId) => !candidateScenarioIds.includes(scenarioId))
  ) {
    errors.push('selection_policy_review_scenario_set_incomplete');
  }
  if (reviewRecord.candidatePolicyDigest !== currentPolicyDigest) {
    errors.push('selection_policy_review_candidate_digest_mismatch');
  }
  if (reviewRecord.approvedPolicyDigest !== currentPolicyDigest) {
    errors.push('selection_policy_review_digest_mismatch');
  }
  if (reviewRecord.approvedPolicyDigest !== reviewRecord.candidatePolicyDigest) {
    errors.push('selection_policy_review_approved_digest_mismatch');
  }
  if (hasForbiddenReviewField(reviewRecord)) {
    errors.push('selection_policy_review_contains_candidate_or_session_field');
  }

  return { valid: errors.length === 0, errors };
};
