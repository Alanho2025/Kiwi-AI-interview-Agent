/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: matchRubricService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { buildStructuredJobDescriptionRubric } from '../jobDescriptionService.js';

/**
 * Purpose: Execute the main responsibility for buildFallbackRubricText.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildFallbackRubricText = (jdRubric = {}) => [
  jdRubric.title,
  ...(jdRubric.roleSummary || []),
  ...(jdRubric.qualifications || []),
  ...(jdRubric.mustHaveRequirements || []),
  ...(jdRubric.niceToHaveExperience || []),
].join('\n');

/**
 * Purpose: Execute the main responsibility for normalizeRubric.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeRubric = async (rawJD, jdRubric) => {
  if (jdRubric?.schemaVersion === 'v3' && jdRubric?.macroCriteria && jdRubric?.microCriteria) return jdRubric;
  if (jdRubric) return buildStructuredJobDescriptionRubric(rawJD || buildFallbackRubricText(jdRubric));
  return buildStructuredJobDescriptionRubric(rawJD || '');
};
