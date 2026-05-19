/**
 * File responsibility: CSRF protection middleware.
 * Main responsibilities:
 * - Protect cookie-authenticated unsafe requests with a double-submit token.
 * - Keep token creation explicit for clients through /auth/csrf.
 */

import crypto from 'crypto';

export const CSRF_COOKIE_NAME = 'csrf_token';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const isProduction = process.env.NODE_ENV === 'production';

export const csrfCookieOptions = {
  httpOnly: false,
  sameSite: isProduction ? 'none' : 'lax',
  secure: isProduction,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

const parseCookies = (cookieHeader = '') =>
  String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      try {
        acc[key] = decodeURIComponent(value);
      } catch {
        acc[key] = value;
      }
      return acc;
    }, {});

const isUnsafeMethod = (method = 'GET') =>
  !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase());

const isGoogleLoginRequest = (req) =>
  req.method.toUpperCase() === 'POST' && req.path === '/auth/google';

const hasBearerAuthHeader = (req) =>
  String(req.headers.authorization || '').toLowerCase().startsWith('bearer ');

export const createCsrfToken = () => crypto.randomBytes(32).toString('hex');

export const getCsrfTokenFromRequest = (req) => {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[CSRF_COOKIE_NAME] || '';
};

export const setCsrfCookie = (res, token = createCsrfToken()) => {
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions);
  return token;
};

export const csrfProtection = (req, res, next) => {
  if (!isUnsafeMethod(req.method)) {
    return next();
  }

  if (isGoogleLoginRequest(req) || hasBearerAuthHeader(req)) {
    return next();
  }

  const cookieToken = getCsrfTokenFromRequest(req);
  const headerToken = String(req.headers[CSRF_HEADER_NAME] || '');

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token is invalid or missing',
      data: null,
      error: {
        code: 'CSRF_TOKEN_INVALID',
        details: 'Refresh the page and try again.',
      },
    });
  }

  return next();
};
