import { buildMatchValidationTargets } from './matchValidationTargetBuilder.js';
import { buildMatchExplanation } from './matchExplanationBuilder.js';
import { ensureArray, unique } from '../../utils/commonHelpers.js';

export const buildMatchAnalysisContract = (analysis = {}) => {
  const explanation = buildMatchExplanation({
    strengths: analysis.strengths || analysis.explanation?.strengths || analysis.explanation?.strengths || [],
    gaps: analysis.gaps || analysis.explanation?.gaps || [],
    risks: analysis.risks || analysis.explanation?.risks || [],
  });
  const requirementChecks = ensureArray(analysis.requirementChecks);
  const missingRequiredSkills = requirementChecks
    .filter((item) => item?.required && item?.passed === false)
    .map((item) => item.requirement || item.label || item.skill)
    .filter(Boolean);
  const missingPreferredSkills = requirementChecks
    .filter((item) => item?.required === false && item?.passed === false)
    .map((item) => item.requirement || item.label || item.skill)
    .filter(Boolean);
  const validationTargets = buildMatchValidationTargets({
    requirementChecks,
    explanation,
    questionPlanHints: analysis.matchingDetails?.questionPlanHints || {},
  });

  return {
    overallScore: Number(analysis.overallScore || analysis.matchScore || 0),
    decision: analysis.decision || {},
    matchedStrengths: unique(explanation.strengths),
    missingRequiredSkills: unique(missingRequiredSkills),
    missingPreferredSkills: unique(missingPreferredSkills),
    capabilityGaps: unique(explanation.gaps),
    riskyClaims: unique(explanation.risks),
    validationTargets,
    questionPlanHints: {
      priorityTopics: unique(analysis.matchingDetails?.questionPlanHints?.priorityTopics || analysis.interviewFocus || []),
      followUpTargets: unique(analysis.matchingDetails?.questionPlanHints?.followUpTargets || []),
      roleCanonical: analysis.matchingDetails?.questionPlanHints?.roleCanonical || analysis.parsedJdProfile?.roleCanonical || analysis.jobTitle || 'general_role',
    },
    explanation,
  };
};
