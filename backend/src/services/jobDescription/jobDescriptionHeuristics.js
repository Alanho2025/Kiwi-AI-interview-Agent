/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: jobDescriptionHeuristics should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { buildRequirementItem } from '../scoringSchemaService.js';
import { buildTaxonomyItem, mergeUniqueLabels } from '../taxonomyService.js';
import {
  MACRO_CRITERIA_HINTS,
  TECH_SKILL_PATTERN,
  SOFT_SKILL_PATTERN,
  unique,
  stripHeadingPrefix,
  cleanLineLabel,
} from './jobDescriptionShared.js';

/**
 * Purpose: Execute the main responsibility for collectMatchingLines.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const collectMatchingLines = (lines, pattern, limit = 4) => {
  const matches = [];
  for (let index = 0; index < lines.length && matches.length < limit; index += 1) {
    const line = lines[index];
    if (!pattern.test(line)) continue;
    const cleaned = stripHeadingPrefix(cleanLineLabel(line) || line);
    if (cleaned) matches.push(cleaned);
  }
  return unique(matches);
};

/**
 * Purpose: Execute the main responsibility for collectSectionItems.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const collectSectionItems = (lines, headings, stopPattern, limit = 8) => {
  const items = [];
  let collecting = false;
  for (const line of lines) {
    if (headings.test(line)) {
      collecting = true;
      const cleaned = cleanLineLabel(line);
      if (cleaned && cleaned !== line) {
        items.push(...cleaned.split(/[,;•]/).map((item) => stripHeadingPrefix(item.trim())));
      }
      continue;
    }
    if (collecting && stopPattern.test(line)) break;
    if (collecting) items.push(...line.split(/[,;•]/).map((item) => stripHeadingPrefix(item.trim())));
    if (items.length >= limit) break;
  }
  return unique(items.filter((item) => item.split(/\s+/).length <= 14)).slice(0, limit);
};

/**
 * Purpose: Execute the main responsibility for collectSkillWords.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const collectSkillWords = (text = '') => unique((text.match(TECH_SKILL_PATTERN) || []).map((item) => item.toLowerCase())).slice(0, 14);
export const collectSoftSkillWords = (text = '') => unique((text.match(SOFT_SKILL_PATTERN) || []).map((item) => item.toLowerCase())).slice(0, 10);

export const deriveMacroCriteria = (rawJD, aiCriteria = []) => {
  const base = aiCriteria.map((label) => buildTaxonomyItem(label, { type: 'macro' }));
  const heuristic = MACRO_CRITERIA_HINTS
    .filter(([, pattern]) => pattern.test(rawJD))
    .map(([label]) => buildTaxonomyItem(label, { type: 'macro' }));
  return mergeUniqueLabels(base, heuristic);
};

/**
 * Purpose: Execute the main responsibility for deriveRequirementItems.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const deriveRequirementItems = ({ mustHaveRequirements, niceToHaveExperience, qualifications, aiRequirements = [] }) => {
  const hardRequirements = mustHaveRequirements.map((label) => buildRequirementItem({ label, type: 'hard', importance: 'high' }));
  const qualificationRequirements = qualifications.slice(0, 4).map((label) => buildRequirementItem({ label, type: 'soft', importance: 'medium' }));
  const preferredRequirements = niceToHaveExperience.slice(0, 4).map((label) => buildRequirementItem({ label, type: 'soft', importance: 'low' }));
  const aiDerivedRequirements = aiRequirements.slice(0, 8).map((label) => buildRequirementItem({ label, type: 'soft', importance: 'medium' }));

  return unique([
    ...hardRequirements,
    ...qualificationRequirements,
    ...preferredRequirements,
    ...aiDerivedRequirements,
  ].map((item) => JSON.stringify(item))).map((value) => JSON.parse(value));
};

/**
 * Purpose: Execute the main responsibility for buildInterviewTargets.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildInterviewTargets = ({ roleCanonical, roleFamily, technicalSkillRequirements, softSkillRequirements, requirements }) => ({
  roleCanonical,
  roleFamily,
  technicalFocus: technicalSkillRequirements.slice(0, 6),
  behaviouralFocus: unique([
    ...softSkillRequirements.slice(0, 4),
    ...requirements.filter((item) => item.type !== 'hard').map((item) => item.label).slice(0, 2),
  ]).slice(0, 6),
  experienceFocus: requirements
    .filter((item) => /experience|years|background|project|production|stakeholder/i.test(item.label))
    .map((item) => item.label)
    .slice(0, 5),
  prioritySkills: technicalSkillRequirements.slice(0, 8),
});
