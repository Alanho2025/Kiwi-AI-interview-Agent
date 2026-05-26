import { requirementStatusToScore, roundScore } from '../scoringSchemaService.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';
import { sumWeightedScores } from './matchShared.js';

const HARD_CAPABILITY_GROUPS = new Set([
  'professional_credential',
  'compliance_ethics_safety',
]);

const TOOL_AND_DATA_GROUPS = new Set([
  'technical_or_tool_skill',
  'data_and_reporting',
  'process_improvement',
]);

const HUMAN_AND_DELIVERY_GROUPS = new Set([
  'communication',
  'stakeholder_collaboration',
  'planning_and_organisation',
  'customer_or_client_focus',
  'leadership_and_ownership',
  'service_delivery',
]);

const DEFAULT_CAPABILITY_WEIGHTS = {
  hardRequirementFit: 0.25,
  capabilityGroupFit: 0.45,
  evidenceQuality: 0.15,
  humanAndDeliveryFit: 0.1,
  toolAndDataFit: 0.05,
};

const getStatusScore = (status = 'not_met') => requirementStatusToScore(status) * 100;

const getEvidenceStrengthScore = (item = {}) => {
  const strength = String(item.notes || '').match(/evidenceStrength=([^;]+)/i)?.[1]?.trim();
  if (item.status === 'not_met') return 0;
  if (strength === 'strong') return 100;
  if (strength === 'partial') return 72;
  if (strength === 'weak') return 38;
  return getStatusScore(item.status);
};

const weightedAverage = (items = [], weightForItem = () => 1) => {
  if (!items.length) return 0;
  return sumWeightedScores(items.map((item) => ({
    score: getStatusScore(item.status),
    weight: weightForItem(item),
  })));
};

const requirementWeight = (item = {}) => {
  if (item.mustHave || item.type === 'hard') return 1.7;
  if (item.importance === 'high') return 1.25;
  if (item.importance === 'low') return 0.75;
  return 1;
};

const groupRequirementsWithChecks = ({ requirements = [], requirementChecks = [] } = {}) => {
  const byLabel = new Map(requirementChecks.map((item) => [normalizeTaxonomyLabel(item.label), item]));
  return requirements.map((requirement) => ({
    ...requirement,
    ...(byLabel.get(normalizeTaxonomyLabel(requirement.label || requirement.text)) || {}),
    label: requirement.label || requirement.text,
    capabilityGroup: requirement.capabilityGroup || 'analysis_and_problem_solving',
  })).filter((item) => !['nice_to_have', 'company_context'].includes(item.category));
};

const buildCapabilityGroupScores = (rows = []) => {
  const grouped = new Map();
  for (const row of rows) {
    const group = row.capabilityGroup || 'analysis_and_problem_solving';
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(row);
  }

  return Object.fromEntries(Array.from(grouped.entries()).map(([group, items]) => [
    group,
    roundScore(weightedAverage(items, requirementWeight), 2),
  ]));
};

const profileWeightedCapabilityFit = ({ capabilityProfile = [], capabilityGroupScores = {}, rows = [] } = {}) => {
  if (Array.isArray(capabilityProfile) && capabilityProfile.length) {
    const weighted = capabilityProfile
      .map((item) => ({
        score: Number(capabilityGroupScores[item.group] || 0),
        weight: Number(item.weight || 0),
      }))
      .filter((item) => item.weight > 0);
    if (weighted.length) return sumWeightedScores(weighted);
  }

  const groups = Object.entries(capabilityGroupScores).map(([group, score]) => ({
    score,
    weight: rows.filter((item) => item.capabilityGroup === group).reduce((sum, item) => sum + requirementWeight(item), 0) || 1,
  }));
  return groups.length ? sumWeightedScores(groups) : 0;
};

const evidenceQualityScore = (requirementChecks = []) => {
  if (!requirementChecks.length) return 0;
  return requirementChecks.reduce((sum, item) => sum + getEvidenceStrengthScore(item), 0) / requirementChecks.length;
};

export const buildCapabilityScoreBreakdown = ({ rubric = {}, requirementChecks = [], fallbackScoreBreakdown = {} } = {}) => {
  const roleProfile = rubric.universalRoleProfile || rubric.metadata?.universalRoleProfile || {};
  const requirements = roleProfile.requirements || rubric.requirements || [];
  const rows = groupRequirementsWithChecks({ requirements, requirementChecks });

  if (!rows.length || !rows.some((item) => item.capabilityGroup)) {
    return fallbackScoreBreakdown;
  }

  const capabilityGroupScores = buildCapabilityGroupScores(rows);
  const capabilityProfile = roleProfile.capabilityProfile || [];
  const capabilityGroupFit = profileWeightedCapabilityFit({ capabilityProfile, capabilityGroupScores, rows });
  const hardItems = rows.filter((item) => item.mustHave || item.type === 'hard' || HARD_CAPABILITY_GROUPS.has(item.capabilityGroup));
  const toolAndDataItems = rows.filter((item) => TOOL_AND_DATA_GROUPS.has(item.capabilityGroup));
  const humanAndDeliveryItems = rows.filter((item) => HUMAN_AND_DELIVERY_GROUPS.has(item.capabilityGroup));
  const highImportanceFallback = rows.filter((item) => item.importance === 'high');

  const dimensions = {
    ...(fallbackScoreBreakdown.semanticDimensions || {}),
    roleDomain: roleProfile.roleDomain || fallbackScoreBreakdown.semanticDimensions?.roleDomain || 'general',
    capabilityGroupFit: roundScore(capabilityGroupFit, 2),
    capabilityGroupScores,
    hardRequirementFit: roundScore(weightedAverage(hardItems.length ? hardItems : highImportanceFallback, requirementWeight), 2),
    toolAndDataFit: roundScore(weightedAverage(toolAndDataItems.length ? toolAndDataItems : rows, requirementWeight), 2),
    humanAndDeliveryFit: roundScore(weightedAverage(humanAndDeliveryItems.length ? humanAndDeliveryItems : rows, requirementWeight), 2),
    evidenceQuality: roundScore(evidenceQualityScore(requirementChecks), 2),
  };

  const overallScore = Object.entries(DEFAULT_CAPABILITY_WEIGHTS)
    .reduce((sum, [key, weight]) => sum + (Number(dimensions[key] || 0) * weight), 0);

  return {
    ...fallbackScoreBreakdown,
    macroScore: dimensions.capabilityGroupFit,
    microScore: dimensions.toolAndDataFit,
    requirementScore: dimensions.hardRequirementFit,
    overallScore: roundScore(overallScore, 2),
    semanticDimensions: dimensions,
  };
};
