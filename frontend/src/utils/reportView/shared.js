/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: shared should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

/**
 * Purpose: Execute the main responsibility for formatNumber.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const formatNumber = (value, digits = 2) => (Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '-');

export const titleCase = (value = '') => String(value)
  .split('_')
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

/**
 * Purpose: Execute the main responsibility for extractFocusAreas.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const extractFocusAreas = (sections = []) => {
  const observation = sections.find((section) => section.id === 'interview_observations');
  const match = String(observation?.content || '').match(/Focus areas:\s*(.+?)\.$/i);
  if (!match?.[1]) return [];
  return match[1].split(',').map((item) => item.trim()).filter(Boolean);
};

/**
 * Purpose: Execute the main responsibility for getScoreBand.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getScoreBand = (overallScore) => {
  if (overallScore >= 80) return 'Strong match';
  if (overallScore >= 65) return 'Promising match';
  if (overallScore >= 45) return 'Developing match';
  return 'Needs stronger evidence';
};
