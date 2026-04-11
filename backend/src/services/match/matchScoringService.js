/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: matchScoringService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import {
  buildExplanationItem,
  buildExplanationObject,
  buildRequirementItem,
  buildScoreItem,
  clampScore,
  requirementStatusToScore,
  roundScore,
} from '../scoringSchemaService.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';
import { normalizeText, tokenize, tokenSet, unique, sumWeightedScores } from './matchShared.js';

/**
 * Purpose: Execute the main responsibility for computeItemMatch.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const computeItemMatch = (label, cvText) => {
  const normalizedCv = normalizeText(cvText);
  const labelText = String(label || '').toLowerCase().trim();
  const labelTokens = unique(tokenize(labelText));
  const cvTokens = tokenSet(normalizedCv);
  const directMatch = labelText.length > 2 && normalizedCv.includes(labelText);
  const overlap = labelTokens.filter((token) => cvTokens.has(token));
  const overlapRatio = labelTokens.length > 0 ? overlap.length / labelTokens.length : 0;

  let status = 'not_met';
  if (directMatch || overlapRatio >= 0.8) status = 'met';
  else if (overlapRatio >= 0.5) status = 'partial';
  else if (overlapRatio > 0) status = 'inferred';

  return {
    status,
    overlap,
    evidence: overlap.length > 0 ? [`Matched tokens: ${overlap.join(', ')}`] : [],
  };
};

/**
 * Purpose: Execute the main responsibility for toPercent.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const toPercent = (value) => clampScore(value * 100);

export const buildMacroScores = (macroCriteria = [], cvText, weights = {}) =>
  macroCriteria.map((criterion) => {
    const match = computeItemMatch(criterion.label, cvText);
    return buildScoreItem({
      label: criterion.label,
      score: toPercent(match.status === 'met' ? 1 : match.status === 'partial' ? 0.6 : match.status === 'inferred' ? 0.3 : 0),
      weight: weights?.macro?.[normalizeTaxonomyLabel(criterion.label)] ?? criterion.weight ?? 1,
      evidence: match.evidence,
      matched: match.status !== 'not_met',
      detail: match.status,
      criterionType: 'macro',
    });
  });

/**
 * Purpose: Execute the main responsibility for buildMicroScores.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildMicroScores = (microCriteria = [], cvText, weights = {}) =>
  microCriteria.map((criterion) => {
    const match = computeItemMatch(criterion.label, cvText);
    return buildScoreItem({
      label: criterion.label,
      score: toPercent(match.status === 'met' ? 1 : match.status === 'partial' ? 0.65 : match.status === 'inferred' ? 0.35 : 0),
      weight: weights?.micro?.[normalizeTaxonomyLabel(criterion.label)] ?? criterion.weight ?? 1,
      evidence: match.evidence,
      matched: match.status !== 'not_met',
      detail: match.status,
      criterionType: 'micro',
    });
  });

/**
 * Purpose: Execute the main responsibility for buildRequirementChecks.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildRequirementChecks = (requirements = [], cvText) =>
  requirements.map((requirement) => {
    const match = computeItemMatch(requirement.label, cvText);
    const status = requirement.status && requirement.status !== 'not_met' ? requirement.status : match.status;
    return buildRequirementItem({
      label: requirement.label,
      type: requirement.type || 'soft',
      importance: requirement.importance || 'medium',
      status,
      evidence: [...(requirement.evidence || []), ...match.evidence],
      sourceChunks: requirement.sourceChunks || [],
    });
  });

/**
 * Purpose: Execute the main responsibility for calculateScoreBreakdown.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const calculateScoreBreakdown = ({ rubric, macroScores, microScores, requirementChecks }) => {
  const macroScore = sumWeightedScores(macroScores);
  const microScore = sumWeightedScores(microScores);
  const requirementScore = requirementChecks.length === 0
    ? 0
    : sumWeightedScores(
        requirementChecks.map((item) => ({
          score: requirementStatusToScore(item.status) * 100,
          weight: item.importance === 'high' ? 1.5 : item.importance === 'low' ? 0.75 : 1,
        }))
      );
  const overallScore = macroScore * (rubric.weights?.overall?.macro ?? 0.45)
    + microScore * (rubric.weights?.overall?.micro ?? 0.35)
    + requirementScore * (rubric.weights?.overall?.requirements ?? 0.2);

  return { macroScore, microScore, requirementScore, overallScore };
};

/**
 * Purpose: Execute the main responsibility for buildLegacyWeightedBreakdown.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildLegacyWeightedBreakdown = ({ macroScore, microScore, requirementScore, requirementChecks }) => {
  const hardItems = requirementChecks.filter((item) => item.type === 'hard');
  const softItems = requirementChecks.filter((item) => item.type !== 'hard');
  const metHard = hardItems.filter((item) => item.status === 'met').length;
  const metSoft = softItems.filter((item) => item.status === 'met').length;

  return {
    softSkills: { label: 'Soft Skill Requirement', weight: 25, rawRatio: roundScore(microScore / 100, 4), score: clampScore(microScore * 0.25), matchedCount: metSoft, totalCount: softItems.length },
    technicalSkills: { label: 'Technical Skill Requirement', weight: 35, rawRatio: roundScore(microScore / 100, 4), score: clampScore(microScore * 0.35), matchedCount: metSoft, totalCount: softItems.length },
    qualificationMatch: { label: 'Qualification / Requirement Match', weight: 20, rawRatio: roundScore(requirementScore / 100, 4), score: clampScore(requirementScore * 0.2), matchedCount: metHard, totalCount: hardItems.length },
    rolesMatch: { label: 'Role / Macro Match', weight: 20, rawRatio: roundScore(macroScore / 100, 4), score: clampScore(macroScore * 0.2), matchedCount: Math.round((macroScore / 100) * 4), totalCount: 4 },
  };
};

/**
 * Purpose: Execute the main responsibility for buildExplanation.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildExplanation = ({ microScores, requirementChecks }) => {
  const strengths = microScores
    .filter((item) => item.score >= 80)
    .slice(0, 4)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Strong matched micro criterion' }));
  const gaps = requirementChecks
    .filter((item) => item.status === 'not_met')
    .slice(0, 4)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Requirement not met' }));
  const risks = requirementChecks
    .filter((item) => item.type === 'hard' && item.status !== 'met')
    .slice(0, 4)
    .map((item) => buildExplanationItem({ label: item.label, evidence: item.evidence, detail: 'Hard requirement risk' }));
  const explanation = buildExplanationObject({
    strengths,
    gaps,
    risks,
    summary: strengths.length > 0
      ? `Top matched areas: ${strengths.map((item) => item.label).join(', ')}.`
      : 'Limited strong matches were found, so the interview should probe fundamentals and evidence depth.',
  });

  return { strengths, gaps, risks, explanation };
};
