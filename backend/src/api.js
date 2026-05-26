/**
 * File responsibility: Application composition module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: api should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import cors from 'cors';
import uploadRoutes from './api/routes/uploadRoutes.js';
import jobDescriptionRoutes from './api/routes/jobDescriptionRoutes.js';
import analyzeRoutes from './api/routes/analyzeRoutes.js';
import interviewRoutes from './api/routes/interviewRoutes.js';
import sessionRoutes from './api/routes/sessionRoutes.js';
import exportRoutes from './api/routes/exportRoutes.js';
import authRoutes from './api/routes/authRoutes.js';
import ragRoutes from './api/routes/ragRoutes.js';
import reportRoutes from './api/routes/reportRoutes.js';
import healthRoutes from './api/routes/healthRoutes.js';
import usageRoutes from './api/routes/usageRoutes.js';
import recordingRoutes from './api/routes/recordingRoutes.js';
import opsLiteRoutes from './api/routes/opsLiteRoutes.js';
import { usageContextMiddleware } from './services/deepseekService.js';
import { errorHandler } from './middleware/errorHandler.js';

import { requestContext } from './middleware/requestContext.js';
import { optionalAuth, requireAuth } from './middleware/authMiddleware.js';
import { csrfProtection } from './middleware/csrfMiddleware.js';
import {
  aiRateLimit,
  exportRateLimit,
  uploadRateLimit,
} from './middleware/rateLimitMiddleware.js';
import { assertRequiredEnv, getAllowedOrigins, loadEnv } from './config/env.js';

loadEnv();
if (process.env.NODE_ENV === 'production') {
  assertRequiredEnv(['JWT_SECRET']);
}
const api = express.Router();

const allowedOrigins = getAllowedOrigins();

console.log('[CORS] Allowed origins:', allowedOrigins);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn('[CORS] Blocked origin:', origin);
    return callback(new Error(`CORS origin not allowed: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Requested-With', 'Authorization'],
};

api.use(cors(corsOptions));
api.options('*', cors(corsOptions));
api.use(express.json({ limit: '2mb' }));
api.use(requestContext);
api.use(optionalAuth);
api.use(csrfProtection);

// Per-request token usage tracking context via AsyncLocalStorage.
// All downstream DeepSeek calls within the same request will see this context.
api.use(usageContextMiddleware);

api.use('/health', healthRoutes);
api.use('/auth', authRoutes);

api.use('/upload', requireAuth, uploadRateLimit, uploadRoutes);
api.use('/job-description', requireAuth, aiRateLimit, jobDescriptionRoutes);
api.use('/analyze', requireAuth, aiRateLimit, analyzeRoutes);
api.use('/interview', requireAuth, aiRateLimit, interviewRoutes);
api.use('/session', requireAuth, sessionRoutes);
api.use('/report', requireAuth, aiRateLimit, reportRoutes);
api.use('/export', requireAuth, exportRateLimit, exportRoutes);
api.use('/rag', requireAuth, aiRateLimit, ragRoutes);
api.use('/usage', requireAuth, usageRoutes);
api.use('/recordings', requireAuth, uploadRateLimit, recordingRoutes);
api.use('/ops-lite', requireAuth, aiRateLimit, opsLiteRoutes);

api.use(errorHandler);
loadEnv();

assertRequiredEnv([
  'JWT_SECRET',
  'GOOGLE_CLIENT_ID',
]);
export default api;
