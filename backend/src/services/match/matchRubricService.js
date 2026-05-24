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
const flattenTechnicalSkills = (technicalSkills = {}) => Object.values(technicalSkills || {})
  .flat()
  .map((item) => item?.label || item?.name || item)
  .filter(Boolean);

const buildFallbackRubricText = (jdRubric = {}) => {
  const overview = jdRubric.jobOverview || {};
  const sections = jdRubric.sections || {};

  return [
    overview.title || jdRubric.title,
    overview.companyName && `Company: ${overview.companyName}`,
    overview.location && `Location: ${overview.location}`,
    overview.contractType && `Contract type: ${overview.contractType}`,
    overview.employmentType && `Employment type: ${overview.employmentType}`,
    ...(sections.responsibilities || jdRubric.roleSummary || []),
    ...(sections.qualifications || jdRubric.qualifications || []),
    ...(sections.mustHaveRequirements || jdRubric.mustHaveRequirements || []),
    ...(sections.niceToHaveRequirements || jdRubric.niceToHaveExperience || []),
    ...flattenTechnicalSkills(sections.technicalSkills || {}),
    ...(sections.softSkills || jdRubric.softSkillRequirements || []),
    ...(sections.benefits || []),
    ...(sections.applicationInstructions || []),
  ].filter(Boolean).join('\n');
};

const requiresHumanReviewedRubricRebuild = (jdRubric = {}) => (
  jdRubric?.metadata?.inputTrustLevel === 'human_reviewed'
  || jdRubric?.metadata?.humanReviewStatus === 'verified'
  || jdRubric?.diagnostics?.humanReviewStatus === 'verified'
);

/**
 * Purpose: Execute the main responsibility for normalizeRubric.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeRubric = async (rawJD, jdRubric) => {
  if (jdRubric?.schemaVersion === 'v3' && jdRubric?.macroCriteria && jdRubric?.microCriteria) return jdRubric;

  if (jdRubric && requiresHumanReviewedRubricRebuild(jdRubric)) {
    return buildStructuredJobDescriptionRubric(buildFallbackRubricText(jdRubric));
  }

  if (jdRubric) return buildStructuredJobDescriptionRubric(rawJD || buildFallbackRubricText(jdRubric));
  return buildStructuredJobDescriptionRubric(rawJD || '');
};
