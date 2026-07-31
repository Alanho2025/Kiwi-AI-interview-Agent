import { buildAnalyzeOutput, deriveDecision, roundScore, clampScore, isNonTechnicalHardRequirement } from '../scoringSchemaService.js';
import { validateAnalyzeOutput } from '../schemaValidationService.js';
import { unique } from './matchShared.js';
import { buildLegacyWeightedBreakdown } from './matchScoringService.js';
import { buildRoleFitDiagnostics } from '../roleFit/roleFitDiagnosticsService.js';

export const calculateConfidence = ({ parsedCvProfile, macroScores, microScores, requirementChecks, cvEvidenceProfile, rubric = {} }) => {
  const hardMissingCount = requirementChecks.filter((item) => item.type === 'hard' && item.status === 'not_met' && !isNonTechnicalHardRequirement(item, rubric)).length;
  const contradictionCount = requirementChecks.filter((item) => {
    const notes = String(item.notes || '');
    const strength = item.evidenceStrength || (notes.match(/evidenceStrength=(\w+)/i)?.[1] || '');
    const hasMissingEvidence = Boolean(item.missingEvidence) || /missingEvidence=/i.test(notes);
    return (
      (strength === 'strong' && item.status === 'not_met')
      || (hasMissingEvidence && ['met', 'partial'].includes(item.status))
    );
  }).length;
  const weakHardEvidenceCount = requirementChecks.filter((item) => {
    const notes = String(item.notes || '');
    const strength = item.evidenceStrength || (notes.match(/evidenceStrength=(\w+)/i)?.[1] || '');
    return (
      item.type === 'hard'
      && ['met', 'partial'].includes(item.status)
      && strength === 'weak'
    );
  }).length;
  const penalty = Math.min(0.18, hardMissingCount * 0.025)
    + Math.min(0.16, contradictionCount * 0.04)
    + Math.min(0.08, weakHardEvidenceCount * 0.02);

  const base = Math.min(
    0.95,
    0.32
    + Math.min(0.22, ((macroScores.length + microScores.length) / 20) * 0.22)
    + Math.min(0.18, requirementChecks.filter((item) => item.evidence.length > 0).length * 0.035)
    + Math.min(0.13, (parsedCvProfile.tokenCount || 0) / 8000)
    + Math.min(0.1, ((cvEvidenceProfile?.sections?.projects || []).length || 0) * 0.03)
    + Math.min(0.08, ((cvEvidenceProfile?.achievements || []).length || 0) * 0.02)
  );

  return roundScore(Math.max(0.35, base - penalty), 2);
};

const hasHardGateFailure = (requirementChecks = [], rubric = {}) => requirementChecks.some((item) => 
  item.type === 'hard' && 
  item.status === 'not_met' && 
  !isNonTechnicalHardRequirement(item, rubric)
);

const deriveRecommendation = (score) => {
  if (score >= 80) return 'strong';
  if (score >= 65) return 'good';
  if (score >= 50) return 'partial';
  return 'weak';
};

export const buildAnalyzeResult = ({
  parsedCvProfile,
  rubric,
  macroScores,
  microScores,
  requirementChecks,
  scoreBreakdown,
  explanation,
  strengths,
  gaps,
  questionPlanHints,
  transitionProfile = {},
  cvEvidenceProfile = {},
  cvAnalysis = {},
  semanticEvidenceContext = {},
  roleEvidenceMap = {},
}) => {
  const confidence = calculateConfidence({ parsedCvProfile, macroScores, microScores, requirementChecks, cvEvidenceProfile, rubric });
  const decision = deriveDecision({ overallScore: scoreBreakdown.overallScore, confidence, hardGateFailed: hasHardGateFailure(requirementChecks, rubric) });
  const roleFitDiagnostics = buildRoleFitDiagnostics({
    roleFitProfile: rubric.roleFit || {},
    roleEvidenceMap,
  });
  const interviewFocus = unique([
    ...(questionPlanHints.priorityTopics || []).slice(0, 3),
    ...questionPlanHints.mustProbeSkills.slice(0, 3),
    ...questionPlanHints.mustProbeExperience.slice(0, 2),
    ...questionPlanHints.mustProbeBehavioural.slice(0, 2),
  ]).slice(0, 6);

  const matchingDetails = {
    weightedBreakdown: buildLegacyWeightedBreakdown({
      macroScore: scoreBreakdown.macroScore,
      microScore: scoreBreakdown.microScore,
      requirementScore: scoreBreakdown.requirementScore,
      requirementChecks,
    }),
    rubric,
    macroScore: scoreBreakdown.macroScore,
    microScore: scoreBreakdown.microScore,
    requirementScore: scoreBreakdown.requirementScore,
    questionPlanHints,
    cvEvidenceProfile,
    cvAnalysis,
    sectionBreakdown: {
      projects: (cvEvidenceProfile.sections?.projects || []).length,
      experienceEntries: (cvEvidenceProfile.sections?.experience || []).length,
      keyCompetencies: (cvEvidenceProfile.sections?.keyCompetencies || []).length,
      achievements: (cvEvidenceProfile.achievements || []).length,
    },
    capabilityMatches: unique(requirementChecks.flatMap((item) => item.notes ? [item.notes] : [])),
    achievementSignals: cvEvidenceProfile.achievements || [],
    semanticEvidenceMatches: semanticEvidenceContext.matches || [],
    semanticEvidenceModel: {
      model: semanticEvidenceContext.model || 'none',
      scorer: semanticEvidenceContext.scorer || 'none',
      providerError: semanticEvidenceContext.providerError || '',
    },
    evidenceStrengthBreakdown: semanticEvidenceContext.evidenceStrengthBreakdown || {},
    evidenceJudgements: semanticEvidenceContext.evidenceJudgements || {},
    universalRoleProfile: rubric.universalRoleProfile || rubric.metadata?.universalRoleProfile || null,
    roleEvidenceMap,
    roleFitDiagnostics,
    transitionProfile,
    scoreDimensions: {
      ...(scoreBreakdown.semanticDimensions || {}),
      technicalReadiness: transitionProfile.technicalReadiness ?? 0,
      transferableStrength: transitionProfile.transferableStrength ?? 0,
      commercialExperience: transitionProfile.commercialExperience ?? 0,
      growthPotential: transitionProfile.growthPotential ?? 0,
    },
  };

  const recommendation = deriveRecommendation(scoreBreakdown.overallScore);

  return validateAnalyzeOutput(
    buildAnalyzeOutput({
      candidateName: parsedCvProfile.candidateName,
      jobTitle: rubric.title || rubric.jobTitle || 'Target Role',
      overallScore: scoreBreakdown.overallScore,
      confidence,
      decision,
      parsedCvProfile: {
        ...parsedCvProfile,
        evidenceProfile: cvEvidenceProfile,
        cvAnalysis,
      },
      parsedJdProfile: rubric,
      macroScores,
      microScores,
      requirementChecks,
      scoreBreakdown: {
        macro: clampScore(scoreBreakdown.macroScore),
        micro: clampScore(scoreBreakdown.microScore),
        requirements: clampScore(scoreBreakdown.requirementScore),
      },
      explanation,
      evidenceMap: [...strengths.map((item) => ({ type: 'strength', ...item })), ...gaps.map((item) => ({ type: 'gap', ...item }))],
      roleEvidenceMap,
      roleFitDiagnostics,
      sourceSnapshots: [{ sourceType: 'jd_rubric', title: rubric.title, criteriaCount: (rubric.microCriteria || []).length + (rubric.macroCriteria || []).length }],
      matchingDetails,
      legacy: {
        interviewFocus,
        planPreview: `Interview emphasis: ${interviewFocus.join(', ') || 'role-specific problem solving'}.`,
      },
      recommendation,
    })
  );
};
