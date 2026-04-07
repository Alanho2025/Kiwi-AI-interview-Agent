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
import { errorHandler } from './middleware/errorHandler.js';
import { optionalAuth, requireAuth } from './middleware/authMiddleware.js';
import dotenv from 'dotenv';

dotenv.config();
const api = express.Router();

api.use(cors({
  origin: true,
  credentials: true,
}));
api.use(express.json());
api.use(optionalAuth);

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
