/**
 * File responsibility: WebSocket security helpers.
 * Main responsibilities:
 * - Keep cookie auth and Origin checks consistent across socket endpoints.
 */

import net from 'node:net';

import { getAllowedOrigins, getTrustedProxyHops } from '../config/env.js';
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

const getRightMostForwardedAddress = (forwardedFor) => {
  const addresses = String(forwardedFor || '')
    .split(',')
    .map((address) => address.trim())
    .filter(Boolean);
  const candidate = addresses.at(-1) || '';
  return net.isIP(candidate) ? candidate : '';
};

export const resolveWebSocketClientAddress = (request = {}) => {
  const directAddress = request.socket?.remoteAddress || 'unknown';
  if (getTrustedProxyHops() !== 1) {
    return directAddress;
  }

  return getRightMostForwardedAddress(request.headers?.['x-forwarded-for'])
    || directAddress;
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
    const address = resolveWebSocketClientAddress(request);
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
