import { ensureArray, normalizeKey } from '../../utils/commonHelpers.js';
import { ensureProofStrategyQuestionCoverage } from './roleFitQuestionCoverageService.js';
import { buildRoleFitDiagnostics } from '../roleFit/roleFitDiagnosticsService.js';

const CLASSIFICATION_STRENGTH = {
  direct: 1,
  adjacent: 0.7,
  weak: 0.4,
  gap: 0,
};

const getEvidenceIds = (mapItem = {}) => mapItem.classification === 'gap'
  ? []
  : ensureArray(mapItem.sourceEvidence).map((evidence) => evidence?.evidenceId).filter(Boolean);

const getProofAngle = (mapItem = {}, isGap = false) => {
  const safeMapItem = mapItem || {};
  return safeMapItem.proofAngle || (isGap ? 'gap_validation' : 'role-fit evidence');
};

const buildPreparationGuidance = ({ mapItem = {}, roleIntentLabel = '', isGap = false } = {}) => {
  const safeMapItem = mapItem || {};
  const evidenceGuidance = safeMapItem.evidenceGuidance || {};
  const proofAngle = getProofAngle(safeMapItem, isGap);
  return {
    proofAngle,
    howToUse: isGap
      ? `Prepare to explain whether you have a clear example for ${roleIntentLabel}.`
      : `Prepare one example that shows ${proofAngle}.`,
    risk: ensureArray(evidenceGuidance.avoidUsingFor)[0] || safeMapItem.limitation || '',
    fitLimits: ensureArray(evidenceGuidance.fitLimits).slice(0, 2),
  };
};

const buildCoverage = ({ roleIntentId = null, mapItem = null, degraded = false } = {}) => {
  const isGap = mapItem?.classification === 'gap';
  const roleIntentLabel = mapItem?.roleIntent || 'this role focus';
  return {
    coverageId: isGap ? `cov-gap-${roleIntentId}` : `cov-intent-${roleIntentId}`,
    type: isGap ? 'gap_validation' : 'role_intent',
    roleIntentId,
    minQuestions: 1,
    evidenceOptions: getEvidenceIds(mapItem),
    proofAngle: getProofAngle(mapItem, isGap),
    evidenceGuidance: mapItem?.evidenceGuidance || {},
    hiringLogicLinks: mapItem?.hiringLogicLinks || {},
    preparationGuidance: buildPreparationGuidance({ mapItem, roleIntentLabel, isGap }),
    allowAdjacentEvidence: true,
    status: degraded ? 'degraded' : 'pending',
  };
};

export const buildInterviewProofStrategy = ({
  roleFitProfile = {},
  roleEvidenceMap = {},
  roleEvidenceMapId = '',
} = {}) => {
  const roleIntentItems = ensureArray(roleFitProfile.roleIntent?.items);
  const mapItems = ensureArray(roleEvidenceMap.items);
  const mapItemsByIntentId = new Map(mapItems.map((item) => [item.roleIntentId, item]));
  const highPriorityIntents = roleIntentItems.filter((item) => item.priority === 'high');
  const targetIntents = highPriorityIntents.length ? highPriorityIntents : roleIntentItems.slice(0, 3);
  const targetRoleIntentIds = targetIntents.map((item) => item.id).filter(Boolean);
  const missingArtifacts = roleIntentItems.length === 0 || mapItems.length === 0;
  const coverageByIntentId = new Map();

  targetRoleIntentIds.forEach((intentId) => {
    coverageByIntentId.set(intentId, buildCoverage({
      roleIntentId: intentId,
      mapItem: mapItemsByIntentId.get(intentId) || null,
      degraded: missingArtifacts,
    }));
  });

  mapItems
    .filter((item) => item.classification === 'gap' && item.roleIntentId)
    .forEach((item) => coverageByIntentId.set(item.roleIntentId, buildCoverage({
      roleIntentId: item.roleIntentId,
      mapItem: item,
      degraded: missingArtifacts,
    })));

  const mustCover = [...coverageByIntentId.values()];
  if (!mustCover.length) {
    mustCover.push({
      coverageId: 'cov-fallback-generic',
      type: 'role_intent',
      roleIntentId: null,
      minQuestions: 1,
      evidenceOptions: [],
      allowAdjacentEvidence: true,
      status: 'degraded',
    });
  }

  const strategy = {
    schemaVersion: 'interview_proof_strategy_v1',
    roleIntentProfileId: roleFitProfile.id || '',
    roleEvidenceMapId: roleEvidenceMapId || roleEvidenceMap.id || roleEvidenceMap.matchAnalysisId || '',
    targetRoleIntentIds,
    mustCover,
    avoidOveruse: {
      maxSameEvidenceRoot: 2,
      maxSameAngle: 1,
    },
    voiceInterviewPolicy: {
      doNotShowRecommendedEvidenceDuringInterview: true,
      storeReasoningForReport: true,
    },
    artifactStatus: missingArtifacts ? 'degraded' : 'ready',
    degradedReason: missingArtifacts ? 'missing_role_fit_artifacts' : null,
  };

  return {
    ...strategy,
    roleFitDiagnostics: buildRoleFitDiagnostics({
      roleFitProfile,
      roleEvidenceMap,
      proofStrategy: strategy,
    }),
  };
};

const extractRequirementValues = (question = {}) => [
  question.requirementId,
  ...ensureArray(question.linkedJdRequirement).flatMap((requirement) => [
    requirement?.requirementId,
    requirement?.id,
    requirement?.requirement,
    requirement?.label,
    requirement?.skill,
    requirement?.text,
  ]),
].filter(Boolean);

const textMatches = (left = '', right = '') => {
  const leftKey = normalizeKey(left);
  const rightKey = normalizeKey(right);
  return Boolean(leftKey && rightKey && (leftKey.includes(rightKey) || rightKey.includes(leftKey)));
};

const findMatchedMapItem = ({ question = {}, mapItems = [] } = {}) => {
  const requirementValues = extractRequirementValues(question);
  const directIdMatch = mapItems.find((item) => requirementValues.includes(item.roleIntentId));
  if (directIdMatch) return directIdMatch;

  return mapItems.find((item) => [question.topic, ...requirementValues]
    .some((value) => textMatches(value, item.roleIntent))) || null;
};

const getEvidenceMapStrength = (mapItem = {}) => {
  const numericScore = Number(mapItem.score);
  if (Number.isFinite(numericScore)) return Math.max(0, Math.min(1, numericScore / 100));
  return CLASSIFICATION_STRENGTH[mapItem.classification] ?? 0;
};

export const addRoleFitMetadataToQuestionPool = ({
  poolItems = [],
  roleEvidenceMap = {},
  roleFitProfile = {},
} = {}) => {
  const mapItems = ensureArray(roleEvidenceMap.items);
  const highPriorityIntentIds = new Set(ensureArray(roleFitProfile.roleIntent?.items)
    .filter((item) => item.priority === 'high')
    .map((item) => item.id));

  return ensureArray(poolItems).map((question) => {
    const matchedIntent = findMatchedMapItem({ question, mapItems });
    if (!matchedIntent?.roleIntentId) {
      return {
        ...question,
        proofPointId: '',
        coverageContractIds: [],
        testedRoleIntentIds: [],
        recommendedEvidenceIds: [],
        evidenceAngle: '',
        evidenceMapStrength: 0,
        coveragePriority: 'optional',
        roleFitReason: '',
      };
    }

    const roleIntentId = matchedIntent.roleIntentId;
    const isGap = matchedIntent.classification === 'gap';
    const proofPointId = isGap ? `cov-gap-${roleIntentId}` : `cov-intent-${roleIntentId}`;
    const isMustCover = isGap || highPriorityIntentIds.has(roleIntentId);
    const roleIntentLabel = matchedIntent.roleIntent || question.topic || 'role fit';
    const evidenceAngle = getProofAngle(matchedIntent, isGap);
    const preparationGuidance = buildPreparationGuidance({
      mapItem: matchedIntent,
      roleIntentLabel,
      isGap,
    });

    return {
      ...question,
      proofPointId,
      coverageContractIds: [proofPointId],
      testedRoleIntentIds: [roleIntentId],
      recommendedEvidenceIds: getEvidenceIds(matchedIntent),
      evidenceAngle,
      preparationGuidance,
      evidenceGuidance: matchedIntent.evidenceGuidance || {},
      hiringLogicCoverage: matchedIntent.hiringLogicLinks || {},
      evidenceMapStrength: getEvidenceMapStrength(matchedIntent),
      coveragePriority: isMustCover ? 'must_cover' : 'optional',
      roleFitReason: isGap
        ? `Probes potential gap in ${roleIntentLabel}.`
        : `Validates candidate experience for ${roleIntentLabel}.`,
    };
  });
};

export const buildRoleFitQuestionPool = ({
  poolItems = [],
  roleEvidenceMap = {},
  roleFitProfile = {},
  context = {},
} = {}) => {
  const proofStrategy = buildInterviewProofStrategy({
    roleFitProfile,
    roleEvidenceMap,
    roleEvidenceMapId: context.matchAnalysisId,
  });
  const enrichedItems = addRoleFitMetadataToQuestionPool({
    poolItems,
    roleEvidenceMap,
    roleFitProfile,
  });
  return ensureProofStrategyQuestionCoverage({
    poolItems: enrichedItems,
    proofStrategy,
    roleFitProfile,
    roleEvidenceMap,
    context,
  });
};
