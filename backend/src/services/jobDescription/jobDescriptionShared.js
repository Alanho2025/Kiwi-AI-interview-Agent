/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: jobDescriptionShared should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

export const ROLE_KEYWORDS = /engineer|developer|manager|designer|analyst|architect|consultant|specialist|intern|scientist|administrator/i;
export const TECH_SKILL_PATTERN = /\b(react|node\.?js|typescript|javascript|python|java|aws|azure|gcp|docker|kubernetes|sql|testing|api|graphql|tailwind|html|css|excel|power bi|tableau|data analysis|machine learning|deep learning|hadoop|spark|statistics|pandas|numpy|tensorflow|pytorch)\b/gi;
export const SOFT_SKILL_PATTERN = /\b(communication|stakeholder management|stakeholder communication|teamwork|collaboration|leadership|problem solving|adaptability|accountability|ownership|willingness to learn|learning mindset|attention to detail|time management|customer service)\b/gi;
export const MACRO_CRITERIA_HINTS = [
  ['technical expertise', /technical|engineering|development|software|data|analytics|tool|platform|sql|python|cloud/i],
  ['communication', /communication|stakeholder|present|written|verbal/i],
  ['leadership', /lead|leadership|mentor|manage|ownership/i],
  ['experience', /experience|years|background|proven|track record/i],
];

/**
 * Purpose: Execute the main responsibility for normalizeWhitespace.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeWhitespace = (text = '') =>
  text.replace(/\r/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

export const toLines = (text = '') =>
  normalizeWhitespace(text)
    .split('\n')
    .map((line) => line.replace(/^[•\-*]\s*/, '').trim())
    .filter(Boolean);

/**
 * Purpose: Execute the main responsibility for unique.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const unique = (items = []) => [...new Set(items.filter(Boolean))];
export const stripHeadingPrefix = (value = '') => value.replace(/^(responsibilities|what this job does|must have|nice to have|preferred|bonus|qualifications|about you|requirements)\s*:\s*/i, '').trim();
export const cleanLineLabel = (line = '') => line.replace(/^[^:]+:\s*/, '').trim();
/**
 * Purpose: Execute the main responsibility for firstMatchingLine.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const firstMatchingLine = (lines, pattern) => lines.find((line) => pattern.test(line)) || '';

export const safeJsonParse = (text) => {
  const fencedMatch = text?.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1] || text || '';
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
  return JSON.parse(candidate);
};
