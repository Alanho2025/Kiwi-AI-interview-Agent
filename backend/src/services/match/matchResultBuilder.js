/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: matchResultBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { buildAnalyzeOutput, deriveDecision, roundScore, clampScore } from '../scoringSchemaService.js';
import { validateAnalyzeOutput } from '../schemaValidationService.js';
import { unique } from './matchShared.js';
import { buildLegacyWeightedBreakdown } from './matchScoringService.js';

/**
 * Purpose: Execute the main responsibility for calculateConfidence.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const calculateConfidence = ({ parsedCvProfile, macroScores, microScores, requirementChecks }) =>
  roundScore(
    Math.min(
      0.95,
      0.35
      + Math.min(0.25, ((macroScores.length + microScores.length) / 20) * 0.25)
      + Math.min(0.2, requirementChecks.filter((item) => item.evidence.length > 0).length * 0.04)
      + Math.min(0.15, parsedCvProfile.tokenCount / 8000)
    ),
    2
  );

/**
 * Purpose: Execute the main responsibility for buildAnalyzeResult.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
}) => {
  const confidence = calculateConfidence({ parsedCvProfile, macroScores, microScores, requirementChecks });
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
  };

  return validateAnalyzeOutput(
    buildAnalyzeOutput({
      candidateName: parsedCvProfile.candidateName,
      jobTitle: rubric.title || rubric.jobTitle || 'Target Role',
      overallScore: scoreBreakdown.overallScore,
      confidence,
      decision,
      parsedCvProfile,
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
