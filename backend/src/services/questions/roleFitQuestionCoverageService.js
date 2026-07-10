import { ensureArray, normalizeText } from '../../utils/commonHelpers.js';
import { buildAssessmentKey, buildQuestionFingerprint } from './questionDeduplicationService.js';
import {
  buildModeCompatibility,
  questionRetentionDate,
  stableQuestionId,
} from './questionArtifactHelpers.js';

const getCoverageIds = (item = {}) => {
  const explicitIds = ensureArray(item.coverageContractIds).filter(Boolean);
  if (explicitIds.length) return explicitIds;
  return item.proofPointId ? [item.proofPointId] : [];
};

export const assessProofStrategyQuestionCoverage = ({ proofStrategy = {}, poolItems = [] } = {}) => {
  const representedIds = new Set(ensureArray(poolItems)
    .filter((item) => item?.status !== 'suppressed' && item?.status !== 'expired')
    .flatMap(getCoverageIds));
  const unresolvedCoverageIds = ensureArray(proofStrategy.mustCover)
    .filter((coverage) => coverage?.status !== 'degraded' && !representedIds.has(coverage.coverageId))
    .map((coverage) => coverage.coverageId);

  return {
    representedCoverageIds: [...representedIds],
    unresolvedCoverageIds,
  };
};

const findRoleIntent = (roleFitProfile = {}, roleIntentId = '') => ensureArray(roleFitProfile.roleIntent?.items)
  .find((item) => item.id === roleIntentId) || null;

const findMapItem = (roleEvidenceMap = {}, roleIntentId = '') => ensureArray(roleEvidenceMap.items)
  .find((item) => item.roleIntentId === roleIntentId) || null;

const buildFallbackText = ({ coverage = {}, roleIntentLabel = 'this role requirement' } = {}) => (
  coverage.type === 'gap_validation'
    ? `This role needs ${roleIntentLabel}. What is the closest example you can give, what did you personally do, and what did you learn?`
    : `Tell me about a specific example that demonstrates ${roleIntentLabel}. What did you personally do, and what was the result?`
);

const buildCoverageFallbackQuestion = ({ coverage, roleFitProfile, roleEvidenceMap, context }) => {
  const roleIntent = findRoleIntent(roleFitProfile, coverage.roleIntentId);
  const mapItem = findMapItem(roleEvidenceMap, coverage.roleIntentId);
  const roleIntentLabel = normalizeText(roleIntent?.statement || mapItem?.roleIntent || 'this role requirement');
  const text = buildFallbackText({ coverage, roleIntentLabel });
  const item = {
    userId: context.userId,
    sessionId: context.sessionId,
    matchAnalysisId: context.matchAnalysisId || null,
    cvFileId: context.cvFileId || null,
    jdFingerprint: context.jdFingerprint || '',
    questionId: stableQuestionId('poolq', [context.sessionId, coverage.coverageId, text]),
    schemaVersion: 'v3',
    sourceStage: 'role_fit_fallback',
    sourceType: 'role_fit_contract_fallback',
    questionRole: 'root_question',
    maxFollowUps: 2,
    followUpStrategies: ['ownership', 'validation', 'result'],
    category: 'role_competency',
    stage: 'role_requirement',
    topic: roleIntentLabel,
    competency: roleIntentLabel,
    questionIntent: coverage.type === 'gap_validation' ? 'validate_gap' : 'validate_role_intent',
    text,
    fallbackText: text,
    spokenDraft: text,
    linkedCvEvidence: [],
    linkedJdRequirement: coverage.roleIntentId ? [{ roleIntentId: coverage.roleIntentId }] : [],
    expectedSignal: ['specific_example', 'personal_ownership', 'result_or_learning'],
    evidenceNeed: ['specific_example', 'personal_ownership', 'result_or_learning'],
    constraints: ['do_not_suggest_candidate_evidence'],
    priorityWeight: 0.8,
    coverageWeight: 1,
    riskWeight: coverage.type === 'gap_validation' ? 0.9 : 0.6,
    modeCompatibility: buildModeCompatibility('role_competency'),
    status: 'active',
    generationMethod: 'deterministic',
    metadata: { fallbackForCoverage: true },
    questionFamily: 'role_specific',
    evidenceMode: 'past_example',
    roleDomain: context.roleDomain || 'general',
    proofPointId: coverage.coverageId,
    coverageContractIds: [coverage.coverageId],
    testedRoleIntentIds: coverage.roleIntentId ? [coverage.roleIntentId] : [],
    recommendedEvidenceIds: ensureArray(coverage.evidenceOptions),
    evidenceAngle: coverage.type === 'gap_validation' ? 'gap_validation' : 'role_intent_evidence',
    evidenceMapStrength: Math.max(0, Math.min(1, Number(mapItem?.score || 0) / 100)),
    coveragePriority: 'must_cover',
    roleFitReason: 'Deterministic fallback for an otherwise unrepresented coverage contract.',
    retentionUntil: questionRetentionDate(),
  };
  return {
    ...item,
    assessmentKey: buildAssessmentKey({ ...item, turnKind: 'root_question' }),
    questionFingerprint: buildQuestionFingerprint(text),
  };
};

export const ensureProofStrategyQuestionCoverage = ({
  poolItems = [],
  proofStrategy = {},
  roleFitProfile = {},
  roleEvidenceMap = {},
  context = {},
} = {}) => {
  const initialCoverage = assessProofStrategyQuestionCoverage({ proofStrategy, poolItems });
  const coveragesById = new Map(ensureArray(proofStrategy.mustCover)
    .map((coverage) => [coverage.coverageId, coverage]));
  const fallbackItems = initialCoverage.unresolvedCoverageIds
    .map((coverageId) => coveragesById.get(coverageId))
    .filter((coverage) => coverage?.roleIntentId)
    .map((coverage) => buildCoverageFallbackQuestion({
      coverage,
      roleFitProfile,
      roleEvidenceMap,
      context,
    }));
  const items = [...ensureArray(poolItems), ...fallbackItems];
  const finalCoverage = assessProofStrategyQuestionCoverage({ proofStrategy, poolItems: items });
  const degraded = proofStrategy.artifactStatus !== 'ready' || finalCoverage.unresolvedCoverageIds.length > 0;

  return {
    items,
    proofStrategy,
    readiness: {
      status: degraded ? 'degraded' : 'ready',
      degradedReason: proofStrategy.degradedReason
        || (finalCoverage.unresolvedCoverageIds.length ? 'unrepresented_must_cover_contracts' : null),
      ...finalCoverage,
    },
  };
};
