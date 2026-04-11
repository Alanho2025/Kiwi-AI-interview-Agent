/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: matchService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
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

/**
 * Purpose: Execute the main responsibility for compareCvToJobDescription.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const compareCvToJobDescription = async (cvText, rawJD, jdRubric, settings = {}) => {
  const rubric = await normalizeRubric(rawJD, jdRubric);
  const parsedCvProfile = buildCvProfile(cvText);
  const macroScores = buildMacroScores(rubric.macroCriteria, cvText, rubric.weights);
  const microScores = buildMicroScores(rubric.microCriteria, cvText, rubric.weights);
  const requirementChecks = buildRequirementChecks(rubric.requirements, cvText);
  const scoreBreakdown = calculateScoreBreakdown({ rubric, macroScores, microScores, requirementChecks });
  const { strengths, gaps, risks, explanation } = buildExplanation({ microScores, requirementChecks });
  const questionPlanHints = buildQuestionPlanHints({ rubric, requirementChecks, microScores, settings });

  return buildAnalyzeResult({
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
  });
};
