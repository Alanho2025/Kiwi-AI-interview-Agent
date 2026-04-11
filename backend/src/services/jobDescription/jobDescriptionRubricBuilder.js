/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: jobDescriptionRubricBuilder should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { buildJdRubricSchema } from '../scoringSchemaService.js';
import { buildTaxonomyItem, canonicalizeRole, inferRoleLevel, mergeUniqueLabels } from '../taxonomyService.js';
import { extractSkillsWithAI } from './jobDescriptionAiService.js';
import { ROLE_KEYWORDS, toLines, cleanLineLabel, firstMatchingLine } from './jobDescriptionShared.js';
import {
  buildInterviewTargets,
  collectMatchingLines,
  collectSectionItems,
  collectSkillWords,
  collectSoftSkillWords,
  deriveMacroCriteria,
  deriveRequirementItems,
} from './jobDescriptionHeuristics.js';

/**
 * Purpose: Execute the main responsibility for buildSectionCollections.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildSectionCollections = (lines) => ({
  responsibilities: unique([
    ...collectMatchingLines(lines, /responsib|you will|what you will do|about the role|day to day|primary responsibilities/i, 5),
    ...collectSectionItems(lines, /responsib|you will|what you will do|about the role|day to day|primary responsibilities/i, /qualif|requirements|must|preferred|skills|about you/i, 8),
  ]).slice(0, 8),
  qualifications: unique([
    ...collectMatchingLines(lines, /qualif|degree|background|proven|experience in|experience with/i, 5),
    ...collectSectionItems(lines, /qualif|about you|what you bring/i, /responsib|requirements|must|preferred|skills/i, 8),
  ]).slice(0, 8),
  mustHaveRequirements: unique([
    ...collectMatchingLines(lines, /must|required|essential/i, 6),
    ...collectSectionItems(lines, /must|required|essential/i, /preferred|bonus|nice to have|desirable/i, 8),
  ]).slice(0, 10),
  niceToHaveExperience: unique([
    ...collectMatchingLines(lines, /nice to have|preferred|bonus|desirable/i, 5),
    ...collectSectionItems(lines, /nice to have|preferred|bonus|desirable/i, /application|benefits|how to apply/i, 6),
  ]).slice(0, 8),
});

/**
 * Purpose: Execute the main responsibility for buildSkillCollections.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildSkillCollections = ({ rawJD, aiSkills }) => {
  const technicalSkillRequirements = unique([...aiSkills.technicalSkillRequirements, ...collectSkillWords(rawJD)]).slice(0, 14);
  const softSkillRequirements = unique([...aiSkills.softSkillRequirements, ...collectSoftSkillWords(rawJD)])
    .filter((item) => !technicalSkillRequirements.includes(item))
    .slice(0, 10);

  return { technicalSkillRequirements, softSkillRequirements };
};

/**
 * Purpose: Execute the main responsibility for buildWeights.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildWeights = ({ rawJD, macroCriteria, microCriteria }) => ({
  macro: Object.fromEntries((macroCriteria.length > 0 ? macroCriteria : deriveMacroCriteria(rawJD)).map((item) => [item.label, 1])),
  micro: Object.fromEntries(microCriteria.map((item) => [item.label, 1])),
  overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
});

/**
 * Purpose: Execute the main responsibility for buildStructuredJobDescriptionRubric.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const buildStructuredJobDescriptionRubric = async (rawJD) => {
  const lines = toLines(rawJD);
  const title = firstMatchingLine(lines.slice(0, 8), ROLE_KEYWORDS)
    || cleanLineLabel(firstMatchingLine(lines, /job title|role title|position title/i))
    || 'Target Role';
  const roleInfo = canonicalizeRole(title, rawJD);
  const roleLevel = inferRoleLevel(rawJD);
  const sections = buildSectionCollections(lines);
  const aiSkills = await extractSkillsWithAI(rawJD);
  const skills = buildSkillCollections({ rawJD, aiSkills });
  const macroCriteria = deriveMacroCriteria(rawJD, aiSkills.macroCriteria);
  const microCriteria = mergeUniqueLabels(
    skills.technicalSkillRequirements.map((label) => ({ label, type: 'micro', category: 'technical', weight: 1 })),
    skills.softSkillRequirements.map((label) => ({ label, type: 'micro', category: 'behavioural', weight: 1 }))
  );
  const requirements = deriveRequirementItems({
    mustHaveRequirements: sections.mustHaveRequirements,
    niceToHaveExperience: sections.niceToHaveExperience,
    qualifications: sections.qualifications,
    aiRequirements: aiSkills.requirements,
  });
  const weights = buildWeights({ rawJD, macroCriteria, microCriteria });
  const interviewTargets = buildInterviewTargets({
    roleCanonical: roleInfo.roleCanonical,
    roleFamily: roleInfo.roleFamily,
    technicalSkillRequirements: skills.technicalSkillRequirements,
    softSkillRequirements: skills.softSkillRequirements,
    requirements,
  });

  return buildJdRubricSchema({
    title,
    roleSummary: sections.responsibilities.length > 0 ? sections.responsibilities : ['Review the original JD text for the detailed role scope.'],
    responsibilities: sections.responsibilities,
    qualifications: sections.qualifications,
    keywords: unique([...skills.technicalSkillRequirements, ...skills.softSkillRequirements, roleInfo.roleCanonical]),
    macroCriteria,
    microCriteria,
    requirements,
    weights,
    technicalSkillRequirements: skills.technicalSkillRequirements,
    softSkillRequirements: skills.softSkillRequirements,
    mustHaveRequirements: sections.mustHaveRequirements,
    niceToHaveExperience: sections.niceToHaveExperience,
    roleCanonical: roleInfo.roleCanonical,
    roleFamily: roleInfo.roleFamily,
    roleLevel,
    interviewTargets,
  });
};

