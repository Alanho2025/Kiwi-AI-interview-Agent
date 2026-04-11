/**
 * File responsibility: Middleware.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: requestContext should apply request pipeline behaviour consistently across the application.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';

/**
 * Purpose: Execute the main responsibility for requestContext.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const requestContext = (req, res, next) => {
  req.requestContext = {
    requestId: req.get('x-request-id') || crypto.randomUUID(),
    startedAt: Date.now(),
  };

  res.setHeader('x-request-id', req.requestContext.requestId);
  next();
};
