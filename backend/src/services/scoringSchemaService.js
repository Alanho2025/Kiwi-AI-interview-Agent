import { buildTaxonomyItem, mergeUniqueLabels, normalizeTaxonomyLabel, uniqueById } from './taxonomyService.js';

const DEFAULT_MACRO_WEIGHTS = {
  experience: 0.3,
  technical_expertise: 0.3,
  communication: 0.2,
  leadership: 0.2,
};

const DEFAULT_OVERALL_WEIGHTS = {
  macro: 0.45,
  micro: 0.35,
  requirements: 0.2,
};

export const requirementStatusToScore = (status = 'not_met') => ({
  met: 1,
  partial: 0.5,
  inferred: 0.25,
  not_met: 0,
}[status] ?? 0);

export const roundScore = (value, digits = 2) => {
  const multiplier = 10 ** digits;
  return Math.round((Number(value) || 0) * multiplier) / multiplier;
};

export const clampScore = (value, min = 0, max = 100) => Math.max(min, Math.min(max, roundScore(value, 2)));

export const normalizeWeights = (weightMap = {}, fallback = {}) => {
  const merged = { ...fallback, ...weightMap };
  const entries = Object.entries(merged).filter(([, value]) => Number(value) > 0);
  const total = entries.reduce((sum, [, value]) => sum + Number(value), 0) || 1;

  return Object.fromEntries(entries.map(([key, value]) => [normalizeTaxonomyLabel(key), roundScore(Number(value) / total, 4)]));
};

export const buildCriteriaItemsFromWeights = (weightMap = {}, type = 'macro') =>
  uniqueById(
    Object.entries(weightMap).map(([label, value]) =>
      buildTaxonomyItem(label, {
        type,
        weight: roundScore(Number(value), 4),
      })
    )
  );

export const buildRequirementItem = ({
  label,
  type = 'soft',
  importance = 'medium',
  status = 'not_met',
  evidence = [],
  sourceChunks = [],
  score,
  notes = '',
} = {}) => ({
  id: normalizeTaxonomyLabel(label),
  label: label?.trim() || '',
  type,
  importance,
  status,
  score: score ?? requirementStatusToScore(status),
  evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : [],
  sourceChunks: Array.isArray(sourceChunks) ? sourceChunks.filter(Boolean) : [],
  notes,
});

export const buildScoreItem = ({
  label,
  score = 0,
  weight = 0,
  evidence = [],
  sourceChunks = [],
  matched = false,
  detail = '',
  criterionType = 'micro',
} = {}) => ({
  id: normalizeTaxonomyLabel(label),
  label: label?.trim() || '',
  criterionType,
  score: roundScore(score, 2),
  weight: roundScore(weight, 4),
  evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : [],
  sourceChunks: Array.isArray(sourceChunks) ? sourceChunks.filter(Boolean) : [],
  matched: Boolean(matched),
  detail,
});

export const buildExplanationObject = ({ strengths = [], gaps = [], risks = [], summary = '' } = {}) => ({
  strengths,
  gaps,
  risks,
  summary,
});

export const buildExplanationItem = ({ label, evidence = [], sourceChunks = [], detail = '' } = {}) => ({
  id: normalizeTaxonomyLabel(label),
  label: label?.trim() || '',
  evidence: Array.isArray(evidence) ? evidence.filter(Boolean) : [],
  sourceChunks: Array.isArray(sourceChunks) ? sourceChunks.filter(Boolean) : [],
  detail,
});

export const deriveDecision = ({ overallScore = 0, confidence = 0, hardGateFailed = false } = {}) => {
  if (hardGateFailed) {
    return { label: 'not_qualified', reasonCodes: ['hard_requirement_failed'] };
  }

  if (confidence < 0.45) {
    return { label: 'manual_review', reasonCodes: ['low_confidence'] };
  }

  if (overallScore >= 80) {
    return { label: 'strong_match', reasonCodes: ['high_overall_score'] };
  }

  if (overallScore >= 65) {
    return { label: 'moderate_match', reasonCodes: ['good_overall_score'] };
  }

  if (overallScore >= 45) {
    return { label: 'borderline', reasonCodes: ['mixed_evidence'] };
  }

  return { label: 'weak_match', reasonCodes: ['low_overall_score'] };
};

export const buildJdRubricSchema = ({
  title = 'Target Role',
  roleSummary = [],
  macroCriteria = [],
  microCriteria = [],
  requirements = [],
  weights = {},
  keywords = [],
  qualifications = [],
  responsibilities = [],
  technicalSkillRequirements = [],
  softSkillRequirements = [],
  mustHaveRequirements = [],
  niceToHaveExperience = [],
  roleCanonical = '',
  roleFamily = '',
  roleLevel = '',
  interviewTargets = {},
  metadata = {},
} = {}) => {
  const normalizedMacroWeights = normalizeWeights(
    weights.macro || Object.fromEntries(macroCriteria.map((item) => [item.label || item.id, item.weight ?? 1])),
    DEFAULT_MACRO_WEIGHTS
  );
  const normalizedMicroWeights = normalizeWeights(
    weights.micro || Object.fromEntries(microCriteria.map((item) => [item.label || item.id, item.weight ?? 1]))
  );
  const normalizedOverallWeights = normalizeWeights(weights.overall || DEFAULT_OVERALL_WEIGHTS, DEFAULT_OVERALL_WEIGHTS);

  const normalizedMacroCriteria = macroCriteria.length > 0
    ? uniqueById(macroCriteria.map((item) => buildTaxonomyItem(item.label || item.id || '', { ...item, type: 'macro' })))
    : buildCriteriaItemsFromWeights(normalizedMacroWeights, 'macro');

  const normalizedMicroCriteria = microCriteria.length > 0
    ? uniqueById(microCriteria.map((item) => buildTaxonomyItem(item.label || item.id || '', { ...item, type: 'micro' })))
    : mergeUniqueLabels(
        technicalSkillRequirements.map((label) => ({ label, type: 'micro', category: 'technical' })),
        softSkillRequirements.map((label) => ({ label, type: 'micro', category: 'behavioural' }))
      );

  const normalizedRequirements = requirements.length > 0
    ? requirements.map((item) => buildRequirementItem(item))
    : mustHaveRequirements.map((label) => buildRequirementItem({ label, type: 'hard', importance: 'high' }));

  return {
    schemaVersion: 'v3',
    jobTitle: title,
    title,
    roleSummary,
    responsibilities,
    qualifications,
    keywords,
    macroCriteria: normalizedMacroCriteria,
    microCriteria: normalizedMicroCriteria,
    requirements: normalizedRequirements,
    weights: {
      macro: normalizedMacroWeights,
      micro: normalizedMicroWeights,
      overall: normalizedOverallWeights,
    },
    technicalSkillRequirements,
    softSkillRequirements,
    mustHaveRequirements,
    niceToHaveExperience,
    roleCanonical,
    roleFamily,
    roleLevel,
    interviewTargets,
    metadata: {
      sourceType: 'jd',
      parserVersion: 'v3',
      confidence: metadata.confidence ?? 0.75,
      sourceLength: metadata.sourceLength ?? 0,
      ...metadata,
    },
  };
};

export const buildAnalyzeOutput = ({
  candidateName = 'Candidate',
  jobTitle = 'Target Role',
  overallScore = 0,
  confidence = 0,
  decision = null,
  parsedCvProfile = {},
  parsedJdProfile = {},
  macroScores = [],
  microScores = [],
  requirementChecks = [],
  scoreBreakdown = {},
  explanation = buildExplanationObject(),
  evidenceMap = [],
  sourceSnapshots = [],
  matchingDetails = {},
  legacy = {},
} = {}) => {
  const hardGateFailed = requirementChecks.some((item) => item.type === 'hard' && item.status === 'not_met');
  const resolvedDecision = decision || deriveDecision({ overallScore, confidence, hardGateFailed });

  return {
    schemaVersion: 'v3',
    candidateName,
    jobTitle,
    overallScore: clampScore(overallScore),
    matchScore: clampScore(overallScore),
    confidence: roundScore(confidence, 2),
    decision: resolvedDecision,
    parsedCvProfile,
    parsedJdProfile,
    macroScores,
    microScores,
    requirementChecks,
    scoreBreakdown,
    explanation,
    evidenceMap,
    sourceSnapshots,
    strengths: explanation.strengths.map((item) => item.label),
    gaps: explanation.gaps.map((item) => item.label),
    riskFlags: explanation.risks.map((item) => item.label),
    interviewFocus: legacy.interviewFocus || [],
    planPreview: legacy.planPreview || explanation.summary,
    matchingDetails,
  };
};
