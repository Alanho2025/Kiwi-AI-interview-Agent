import jwt from 'jsonwebtoken';

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

const readBearerToken = (authorizationHeader = '') => {
  const [scheme, token] = authorizationHeader.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return '';
  }
  return token.trim();
};

const verifyToken = (token) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret_for_dev';
  return jwt.verify(token, secret);
};

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
