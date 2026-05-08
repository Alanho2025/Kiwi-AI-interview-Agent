/**
 * File responsibility: HTTP abuse-control middleware.
 * Main responsibilities:
 * - Apply scoped in-memory request limits to high-risk and high-cost routes.
 * - Stay disabled in tests so robustness suites remain deterministic.
 */

import rateLimit from 'express-rate-limit';

const isTest = process.env.NODE_ENV === 'test';

const noopLimiter = (_req, _res, next) => next();

const createLimiter = ({ windowMs, max, message }) => {
  if (isTest) {
    return noopLimiter;
  }

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      message,
      data: null,
      error: {
        code: 'RATE_LIMITED',
        details: message,
      },
    },
  });
};

export const authRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many authentication attempts. Please wait and try again.',
});

export const uploadRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: 'Too many upload requests. Please wait and try again.',
});

export const aiRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 80,
  message: 'Too many AI requests. Please wait and try again.',
});

export const exportRateLimit = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 40,
  message: 'Too many export requests. Please wait and try again.',
});
