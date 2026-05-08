/**
 * File responsibility: JWT token helpers.
 * Main responsibilities:
 * - Keep token signing and verification on one explicit secret source.
 * - Fail fast when auth is used without a configured JWT_SECRET.
 */

import jwt from 'jsonwebtoken';
import { getEnv } from '../config/env.js';

const JWT_EXPIRES_IN = '30d';

export const getJwtSecret = () => {
  const secret = getEnv('JWT_SECRET');
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
};

export const generateAuthToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });

export const verifyAuthToken = (token) =>
  jwt.verify(token, getJwtSecret());
