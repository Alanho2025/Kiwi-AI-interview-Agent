import { buildCvProfile as buildStructuredCvProfile } from '../cv/cvProfileBuilderService.js';

/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: matchShared should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

/**
 * Purpose: Execute the main responsibility for normalizeText.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeText = (text = '') => String(text || '').toLowerCase();
export const tokenize = (text = '') => normalizeText(text).split(/[^a-z0-9+#.]+/).filter(Boolean);
export const unique = (items = []) => [...new Set(items.filter(Boolean))];
/**
 * Purpose: Execute the main responsibility for tokenSet.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const tokenSet = (text = '') => new Set(tokenize(text));

export const extractCandidateName = (cvText = '') => {
  const firstLine = (cvText || '').split('\n').map((line) => line.trim()).find(Boolean) || '';
  if (/^[A-Za-z][A-Za-z' -]{1,60}$/.test(firstLine) && firstLine.split(/\s+/).length <= 4) return firstLine;
  return 'Candidate';
};

/**
 * Purpose: Execute the main responsibility for buildCvProfile.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildCvProfile = (cvText) => {
  const profile = buildStructuredCvProfile(cvText);
  return {
    ...profile,
    rawLength: cvText?.length || 0,
    tokenCount: tokenize(cvText).length,
    candidateName: profile.candidateName || extractCandidateName(cvText),
    evidencePreview: normalizeText(cvText).slice(0, 300),
  };
};

/**
 * Purpose: Execute the main responsibility for sumWeightedScores.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const sumWeightedScores = (items = []) => {
  const totalWeight = items.reduce((sum, item) => sum + (Number(item.weight) || 0), 0) || 1;
  const weighted = items.reduce((sum, item) => sum + (Number(item.score) || 0) * (Number(item.weight) || 0), 0);
  return weighted / totalWeight;
};
