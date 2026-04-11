/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: jobDescriptionService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

export { extractSkillsWithAI } from './jobDescription/jobDescriptionAiService.js';
export { buildStructuredJobDescriptionRubric } from './jobDescription/jobDescriptionRubricBuilder.js';
export { formatStructuredJobDescription } from './jobDescription/jobDescriptionFormatter.js';
