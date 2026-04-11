/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: responseFormatter should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

/**
 * Purpose: Execute the main responsibility for formatSuccess.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const formatSuccess = (message, data = {}) => ({
  success: true,
  message,
  data,
  error: null,
});

/**
 * Purpose: Execute the main responsibility for formatError.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const formatError = (message, code, details) => ({
  success: false,
  message,
  data: null,
  error: {
    code,
    details,
  },
});
