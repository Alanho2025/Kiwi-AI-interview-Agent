/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportGeneratorShared should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
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
export const normalizeText = (value = '') => String(value || '').trim();
export const toWords = (value = '') => normalizeText(value).split(/\s+/).filter(Boolean);
export const lower = (value = '') => normalizeText(value).toLowerCase();

/**
 * Purpose: Execute the main responsibility for joinLabels.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const joinLabels = (items = [], limit = 4) => items
  .slice(0, limit)
  .map((item) => item.label)
  .filter(Boolean)
  .join(', ');

const interviewQuestionStarters = [
  'tell me about',
  'what was your',
  'can you walk me through',
  'before we finish',
  'please introduce yourself',
  'how did you',
  'why did you',
  'what did you',
  'could you',
  'would you',
];

/**
 * Purpose: Execute the main responsibility for isQuestionTurn.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const isQuestionTurn = (turn = {}) => {
  if (turn.role !== 'ai') return false;
  if (turn.questionId) return true;
  const text = lower(turn.text);
  return text.endsWith('?') || interviewQuestionStarters.some((starter) => text.startsWith(starter));
};

/**
 * Purpose: Execute the main responsibility for getScoreBand.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getScoreBand = (overallScore = 0) => {
  if (overallScore >= 80) return 'Strong match';
  if (overallScore >= 65) return 'Promising match';
  if (overallScore >= 45) return 'Developing match';
  return 'Needs stronger evidence';
};

/**
 * Purpose: Execute the main responsibility for getDecisionLabel.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const getDecisionLabel = (analysisResult = {}) => analysisResult.decision?.label || 'manual_review';
