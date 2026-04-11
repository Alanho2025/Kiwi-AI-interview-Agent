/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: appError should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

export class AppError extends Error {
  constructor(message, {
    statusCode = 500,
    code = 'SERVER_ERROR',
    details = message,
    expose = statusCode < 500,
    meta = {},
  } = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;
    this.meta = meta;
  }
}

/**
 * Purpose: Execute the main responsibility for badRequest.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const badRequest = (message, details = message, meta = {}) => new AppError(message, {
  statusCode: 400,
  code: 'BAD_REQUEST',
  details,
  meta,
});

/**
 * Purpose: Execute the main responsibility for unauthorized.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const unauthorized = (message = 'Unauthorized', details = message, meta = {}) => new AppError(message, {
  statusCode: 401,
  code: 'UNAUTHORIZED',
  details,
  meta,
});

/**
 * Purpose: Execute the main responsibility for notFound.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const notFound = (message = 'Not found', details = message, meta = {}) => new AppError(message, {
  statusCode: 404,
  code: 'NOT_FOUND',
  details,
  meta,
});

/**
 * Purpose: Execute the main responsibility for invalidState.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const invalidState = (message, details = message, meta = {}) => new AppError(message, {
  statusCode: 400,
  code: 'INVALID_STATE',
  details,
  meta,
});
