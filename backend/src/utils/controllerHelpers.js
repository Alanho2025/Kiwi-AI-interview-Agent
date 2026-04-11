/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: controllerHelpers should provide focused helper logic without reaching into unrelated domain state.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { badRequest, notFound } from './appError.js';

/**
 * Purpose: Execute the main responsibility for requireBodyField.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const requireBodyField = (req, fieldName, message) => {
  const value = req.body?.[fieldName];
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    throw badRequest(message || `Missing ${fieldName}`, message || `${fieldName} is required`);
  }
  return value;
};

/**
 * Purpose: Execute the main responsibility for requireEntity.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const requireEntity = (entity, message = 'Resource not found', details = 'Requested resource does not exist') => {
  if (!entity) {
    throw notFound(message, details);
  }
  return entity;
};
