/**
 * File responsibility: Service module.
 */
import { buildCvProfile } from './match/matchShared.js';
import { normalizeRubric } from './match/matchRubricService.js';
import {
  buildMacroScores,
  buildMicroScores,
  buildRequirementChecks,
  calculateScoreBreakdown,
  buildExplanation,
} from './match/matchScoringService.js';
import { buildQuestionPlanHints } from './match/questionPlanService.js';
import { buildAnalyzeResult } from './match/matchResultBuilder.js';
import { buildCvEvidenceProfile } from './cv/cvEvidenceProfileBuilder.js';
import { buildTransitionProfile } from './match/transitionAwareScoring.js';

export const compareCvToJobDescription = async (cvInput, rawJD, jdRubric, settings = {}) => {
  const rubric = await normalizeRubric(rawJD, jdRubric);
  const rawCvText = typeof cvInput === 'string' ? cvInput : cvInput?.normalizedText || '';
  const parsedCvProfile = cvInput?.cvProfile || buildCvProfile(rawCvText);
  const cvEvidenceProfile = cvInput?.evidenceProfile || parsedCvProfile.evidenceProfile || buildCvEvidenceProfile(parsedCvProfile, rawCvText);

  const macroScores = buildMacroScores(rubric.macroCriteria, rawCvText, rubric.weights, cvEvidenceProfile);
  const microScores = buildMicroScores(rubric.microCriteria, rawCvText, rubric.weights, cvEvidenceProfile);
  const requirementChecks = buildRequirementChecks(rubric.requirements, rawCvText, cvEvidenceProfile);
  const scoreBreakdown = calculateScoreBreakdown({ rubric, macroScores, microScores, requirementChecks });
  const transitionProfile = buildTransitionProfile({ evidenceProfile: cvEvidenceProfile, parsedCvProfile });
  const { strengths, gaps, risks, explanation } = buildExplanation({ microScores, requirementChecks, cvEvidenceProfile });
  const questionPlanHints = buildQuestionPlanHints({ rubric, requirementChecks, microScores, settings, cvEvidenceProfile, transitionProfile });

  return buildAnalyzeResult({
    parsedCvProfile: {
      ...parsedCvProfile,
      evidenceProfile: cvEvidenceProfile,
    },
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
    transitionProfile,
    cvEvidenceProfile,
  });
};
