/**
 * File responsibility: Environment configuration helpers.
 * Main responsibilities:
 * - Keep local and Render deployment environment loading consistent.
 * - Resolve shared environment variables without hard-coding platform-specific names.
 * - Keep CORS origin parsing in one reusable place.
 * Maintenance notes:
 * - Do not place secret values in this file.
 * - Add new variable aliases here when deployment platforms use different names.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

let envLoaded = false;

/**
 * Load .env for local development while allowing Render-provided variables to win.
 */
export const loadEnv = () => {
  if (envLoaded) {
    return;
  }

  dotenv.config({ path: path.join(projectRoot, '.env'), override: false, quiet: true });
  envLoaded = true;
};

/**
 * Resolve the first configured environment variable from a list of aliases.
 */
export const getEnv = (...names) => {
  loadEnv();

  for (const name of names) {
    const value = process.env[name];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }

  return '';
};

/**
 * Resolve a boolean environment flag with a safe default.
 */
export const getBooleanEnv = (name, defaultValue = false) => {
  const value = getEnv(name);
  if (!value) {
    return defaultValue;
  }

  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

/**
 * Resolve the HTTP port for Render and local development.
 */
export const getServerPort = () => Number(getEnv('PORT') || 3000);

/**
 * Resolve comma-separated CORS origins.
 */
const normalizeOrigin = (origin) => {
  const trimmed = String(origin).trim().replace(/\/$/, '');

  if (!trimmed) {
    return '';
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  return `https://${trimmed}`;
};

const splitOrigins = (value) => String(value || '')
  .split(',')
  .map(normalizeOrigin)
  .filter(Boolean);

export const getAllowedOrigins = () => {
  const configured = [
    getEnv('FRONTEND_ORIGIN'),
    getEnv('FRONTEND_URL'),
    getEnv('CLIENT_ORIGIN'),
    getEnv('CLIENT_URL'),
    getEnv('ALLOWED_ORIGINS'),
    getEnv('VERCEL_URL'),
  ]
    .flatMap(splitOrigins);

  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
  ];

  return [...new Set([...configured, ...defaults])];
};

export const isProduction = () => getEnv('NODE_ENV') === 'production';
