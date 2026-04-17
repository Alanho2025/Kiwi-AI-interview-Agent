/**
 * File responsibility: Middleware.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: errorHandler should apply request pipeline behaviour consistently across the application.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { formatError } from '../utils/responseFormatter.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

/**
 * Purpose: Execute the main responsibility for errorHandler.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const errorHandler = (err, req, res, _next) => {
  const isFileTypeError = err.message === 'Only PDF and DOCX files are allowed';
  const isFileSizeError = err.code === 'LIMIT_FILE_SIZE';

  const statusCode = isFileTypeError
    ? 400
    : isFileSizeError
      ? 400
      : err.statusCode || 500;

  const code = isFileTypeError
    ? 'VALIDATION_ERROR'
    : isFileSizeError
      ? 'VALIDATION_ERROR'
      : err.code || 'SERVER_ERROR';

  const details = isFileTypeError
    ? err.message
    : isFileSizeError
      ? 'File size exceeds 5MB limit'
      : err.expose
        ? err.details || err.message
        : 'An unexpected error occurred';

  logger.error('Request failed', getRequestLogMeta(req, {
    statusCode,
    code,
    error: err,
  }));

  res.status(statusCode).json(formatError(
    statusCode >= 500 ? 'Internal server error' : err.message,
    code,
    details,
  ));
};
