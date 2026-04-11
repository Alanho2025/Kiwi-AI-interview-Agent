/**
 * File responsibility: Middleware.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: authMiddleware should apply request pipeline behaviour consistently across the application.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import jwt from 'jsonwebtoken';

/**
 * Purpose: Execute the main responsibility for parseCookies.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const parseCookies = (cookieHeader = '') =>
  cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) {
        return acc;
      }

      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});

/**
 * Purpose: Execute the main responsibility for readBearerToken.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const readBearerToken = (authorizationHeader = '') => {
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return '';
  }
  return token.trim();
};

/**
 * Purpose: Execute the main responsibility for verifyToken.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_for_dev';
  return jwt.verify(token, secret);
};

/**
 * Purpose: Execute the main responsibility for optionalAuth.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const optionalAuth = (req, _res, next) => {
  try {
    const cookies = parseCookies(req.headers.cookie || '');
    const token = cookies.auth_token || readBearerToken(req.headers.authorization || '');

    if (!token) {
      req.user = null;
      return next();
    }

    const payload = verifyToken(token);
    req.user = { id: payload.id };
    return next();
  } catch (_error) {
    req.user = null;
    return next();
  }
};

/**
 * Purpose: Execute the main responsibility for requireAuth.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const requireAuth = (req, res, next) =>
  req.user?.id
    ? next()
    : res.status(401).json({
        success: false,
        message: 'Authentication required',
        data: null,
        error: {
          code: 'UNAUTHORIZED',
          details: 'Please sign in before using this feature.',
        },
      });
