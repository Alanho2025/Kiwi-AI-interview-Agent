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
import { errorHandler } from './middleware/errorHandler.js';
import { requestContext } from './middleware/requestContext.js';
import { optionalAuth, requireAuth } from './middleware/authMiddleware.js';
import dotenv from 'dotenv';

dotenv.config();
const api = express.Router();

api.use(cors({
  origin: true,
  credentials: true,
}));
api.use(express.json());
api.use(requestContext);
api.use(optionalAuth);

api.use('/health', healthRoutes);
api.use('/auth', authRoutes);
api.use('/upload', requireAuth, uploadRoutes);
api.use('/job-description', requireAuth, jobDescriptionRoutes);
api.use('/analyze', requireAuth, analyzeRoutes);
api.use('/interview', requireAuth, interviewRoutes);
api.use('/session', requireAuth, sessionRoutes);
api.use('/export', requireAuth, exportRoutes);
api.use('/rag', requireAuth, ragRoutes);
api.use('/report', requireAuth, reportRoutes);

api.use(errorHandler);

export default api;
