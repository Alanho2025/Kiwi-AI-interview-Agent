/**
 * File responsibility: WebSocket security helpers.
 * Main responsibilities:
 * - Keep cookie auth and Origin checks consistent across socket endpoints.
 */

import { getAllowedOrigins } from '../config/env.js';
import { verifyAuthToken } from '../services/authTokenService.js';

export const parseCookies = (cookieHeader = '') =>
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

export const parseCookieAuth = (request = {}) => {
  const cookies = parseCookies(request.headers?.cookie || '');
  const token = cookies.auth_token || '';
  if (!token) return null;

  return parseJwtAuthToken(token);
};

export const parseJwtAuthToken = (token = '') => {
  if (!token) return null;

  try {
    return verifyAuthToken(token);
  } catch {
    return null;
  }
};

export const isAllowedWebSocketOrigin = (request = {}) => {
  const origin = request.headers?.origin;
  if (!origin) return true;
  return getAllowedOrigins().includes(String(origin).replace(/\/$/, ''));
};

export const rejectUpgrade = (socket, statusCode = 403, reason = 'Forbidden') => {
  socket.write(`HTTP/1.1 ${statusCode} ${reason}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
};

export const createWebSocketUpgradeLimiter = ({
  windowMs = 60 * 1000,
  max = 30,
} = {}) => {
  if (process.env.NODE_ENV === 'test') {
    return () => true;
  }

  const hitsByAddress = new Map();

  return (request) => {
    const address = request.socket?.remoteAddress || 'unknown';
    const now = Date.now();
    const current = hitsByAddress.get(address) || { count: 0, resetAt: now + windowMs };

    if (now > current.resetAt) {
      hitsByAddress.set(address, { count: 1, resetAt: now + windowMs });
      return true;
    }

    current.count += 1;
    hitsByAddress.set(address, current);
    return current.count <= max;
  };
};
