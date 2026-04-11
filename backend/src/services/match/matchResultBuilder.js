import { buildAnalyzeOutput, deriveDecision, roundScore, clampScore } from '../scoringSchemaService.js';
import { validateAnalyzeOutput } from '../schemaValidationService.js';
import { unique } from './matchShared.js';
import { buildLegacyWeightedBreakdown } from './matchScoringService.js';

export const calculateConfidence = ({ parsedCvProfile, macroScores, microScores, requirementChecks, cvEvidenceProfile }) =>
  roundScore(
    Math.min(
      0.95,
      0.32
      + Math.min(0.22, ((macroScores.length + microScores.length) / 20) * 0.22)
      + Math.min(0.18, requirementChecks.filter((item) => item.evidence.length > 0).length * 0.035)
      + Math.min(0.13, (parsedCvProfile.tokenCount || 0) / 8000)
      + Math.min(0.1, ((cvEvidenceProfile?.sections?.projects || []).length || 0) * 0.03)
      + Math.min(0.08, ((cvEvidenceProfile?.achievements || []).length || 0) * 0.02)
    ),
    2
  );

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
  risks,
  questionPlanHints,
  transitionProfile = {},
  cvEvidenceProfile = {},
}) => {
  const confidence = calculateConfidence({ parsedCvProfile, macroScores, microScores, requirementChecks, cvEvidenceProfile });
  const decision = deriveDecision({ overallScore: scoreBreakdown.overallScore, confidence, hardGateFailed: risks.length > 0 });
  const interviewFocus = unique([
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
    sectionBreakdown: {
      projects: (cvEvidenceProfile.sections?.projects || []).length,
      experienceEntries: (cvEvidenceProfile.sections?.experience || []).length,
      keyCompetencies: (cvEvidenceProfile.sections?.keyCompetencies || []).length,
      achievements: (cvEvidenceProfile.achievements || []).length,
    },
    capabilityMatches: unique(requirementChecks.flatMap((item) => item.notes ? [item.notes] : [])),
    achievementSignals: cvEvidenceProfile.achievements || [],
    transitionProfile,
    scoreDimensions: {
      technicalReadiness: transitionProfile.technicalReadiness ?? 0,
      transferableStrength: transitionProfile.transferableStrength ?? 0,
      commercialExperience: transitionProfile.commercialExperience ?? 0,
      growthPotential: transitionProfile.growthPotential ?? 0,
    },
  };

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
      sourceSnapshots: [{ sourceType: 'jd_rubric', title: rubric.title, criteriaCount: (rubric.microCriteria || []).length + (rubric.macroCriteria || []).length }],
      matchingDetails,
      legacy: {
        interviewFocus,
        planPreview: `Interview emphasis: ${interviewFocus.join(', ') || 'role-specific problem solving'}.`,
      },
    })
  );
};
