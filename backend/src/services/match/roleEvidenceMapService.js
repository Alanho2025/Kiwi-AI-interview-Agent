import { normalizeTaxonomyLabel } from '../taxonomyService.js';

const STATUS_SCORE = { met: 100, partial: 65, inferred: 35, not_met: 0 };
const WEIGHTS = {
  semanticRelevance: 0.25,
  jdRequirementMatch: 0.2,
  roleIntentMatch: 0.2,
  specificity: 0.15,
  personalOwnership: 0.1,
  outcomeEvidence: 0.1,
};

const clampScore = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
const normalizeKey = (value = '') => normalizeTaxonomyLabel(String(value || ''));

const findRequirementCheck = (requirementChecks = [], statement = '') => {
  const key = normalizeKey(statement);
  return requirementChecks.find((item) => normalizeKey(item.label) === key)
    || requirementChecks.find((item) => {
      const itemKey = normalizeKey(item.label);
      return itemKey && key && (itemKey.includes(key) || key.includes(itemKey));
    })
    || null;
};

const getSemanticMatches = (semanticEvidenceContext = {}, statement = '') => {
  const key = normalizeKey(statement);
  if (semanticEvidenceContext.byLabel?.[key]) return semanticEvidenceContext.byLabel[key];
  const adjacentKey = Object.keys(semanticEvidenceContext.byLabel || {})
    .find((candidate) => {
      const candidateKey = normalizeKey(candidate);
      return candidateKey === key || candidateKey.includes(key) || key.includes(candidateKey);
    });
  return adjacentKey ? semanticEvidenceContext.byLabel[adjacentKey] : [];
};

const hasSourceTrace = (match = {}) => Boolean(
  (match.id || match.evidenceId)
  && match.sourceTrace?.section
  && match.sourceTrace?.sourceType
  && (match.sourceTrace?.chunkId || match.chunkId)
);

const calculateSpecificity = (match = {}) => {
  if (Number.isFinite(Number(match.signals?.specificity))) {
    return clampScore(Number(match.signals.specificity) * 100);
  }
  const text = String(match.text || '');
  let score = text.length >= 45 ? 55 : 35;
  if (/\d|%|percent/i.test(text)) score += 25;
  if ((match.tools || []).length) score += 20;
  return clampScore(score);
};

const buildComponentScores = ({ roleIntent = {}, requirementCheck = null, match = null } = {}) => ({
  semanticRelevance: clampScore(Number(match?.score || 0) * 100),
  jdRequirementMatch: STATUS_SCORE[requirementCheck?.status] ?? 0,
  roleIntentMatch: requirementCheck ? 100 : match ? 70 : roleIntent.priority === 'high' ? 0 : 35,
  specificity: match ? calculateSpecificity(match) : 0,
  personalOwnership: match?.signals?.personalOwnership || match?.responsibilitySignal ? 100 : 0,
  outcomeEvidence: match?.signals?.outcome || match?.achievementSignal ? 100 : 0,
});

const weightedScore = (componentScores = {}) => clampScore(Object.entries(WEIGHTS)
  .reduce((total, [key, weight]) => total + (Number(componentScores[key]) || 0) * weight, 0));

const classifyEvidence = ({ score, match, requirementCheck }) => {
  if (!match || !hasSourceTrace(match)) return 'gap';
  if (score >= 80 && requirementCheck?.status === 'met' && match.evidenceStrength === 'strong') return 'direct';
  if (score >= 60) return 'adjacent';
  if (score >= 35) return 'weak';
  return 'gap';
};

const buildLimitation = ({ classification, match, requirementCheck }) => {
  if (!match || !hasSourceTrace(match)) return 'No explicit CV source trace supports this role intent.';
  if (classification === 'direct') return '';
  if (classification === 'adjacent') {
    if (!match.achievementSignal && !match.signals?.outcome) return 'Related evidence exists, but direct outcome or scope proof is not explicit.';
    return 'Transferable evidence exists, but direct role-level proof should be validated.';
  }
  if (classification === 'weak') return 'The CV wording is related, but applied ownership and outcome evidence are limited.';
  return requirementCheck?.status === 'not_met'
    ? 'The reviewed CV does not currently support this JD requirement.'
    : 'The available evidence is below the grounded match threshold.';
};

const buildMapItem = ({ roleIntent, requirementChecks, semanticEvidenceContext }) => {
  const requirementCheck = findRequirementCheck(requirementChecks, roleIntent.statement);
  const semanticMatches = getSemanticMatches(semanticEvidenceContext, roleIntent.statement);
  const tracedMatches = semanticMatches.filter(hasSourceTrace);
  const topMatch = semanticMatches[0] || null;
  const componentScores = buildComponentScores({ roleIntent, requirementCheck, match: topMatch });
  const score = weightedScore(componentScores);
  const classification = classifyEvidence({ score, match: topMatch, requirementCheck });

  return {
    id: `role-evidence:${roleIntent.id}`,
    roleIntentId: roleIntent.id,
    roleIntent: roleIntent.statement,
    priority: roleIntent.priority || requirementCheck?.importance || 'medium',
    classification,
    score,
    componentScores,
    sourceEvidence: classification === 'gap'
      ? []
      : tracedMatches.slice(0, 3).map((match) => ({
        evidenceId: match.id || match.evidenceId,
        text: match.text,
        evidenceStrength: match.evidenceStrength || 'weak',
        semanticScore: Number(Number(match.score || 0).toFixed(4)),
        sourceTrace: match.sourceTrace,
      })),
    limitation: buildLimitation({ classification, match: topMatch, requirementCheck }),
    requirementStatus: requirementCheck?.status || 'not_mapped',
  };
};

const buildIntentCoverage = (items = []) => {
  const highPriorityItems = items.filter((item) => item.priority === 'high');
  return {
    highPriorityTotal: highPriorityItems.length,
    strong: highPriorityItems.filter((item) => item.classification === 'direct').length,
    partial: highPriorityItems.filter((item) => ['adjacent', 'weak'].includes(item.classification)).length,
    missing: highPriorityItems.filter((item) => item.classification === 'gap').length,
  };
};

export const buildRoleEvidenceMap = ({ roleFitProfile = {}, requirementChecks = [], semanticEvidenceContext = {} } = {}) => {
  const items = (roleFitProfile.roleIntent?.items || []).map((roleIntent) => buildMapItem({
    roleIntent,
    requirementChecks,
    semanticEvidenceContext,
  }));

  return {
    schemaVersion: 'role_evidence_map_v1',
    scoringVersion: 'role_evidence_weighted_v1',
    items,
    intentCoverage: buildIntentCoverage(items),
    classificationCounts: {
      direct: items.filter((item) => item.classification === 'direct').length,
      adjacent: items.filter((item) => item.classification === 'adjacent').length,
      weak: items.filter((item) => item.classification === 'weak').length,
      gap: items.filter((item) => item.classification === 'gap').length,
    },
  };
};
