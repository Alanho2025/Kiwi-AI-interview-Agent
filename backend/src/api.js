import express from 'express';
import cors from 'cors';
import uploadRoutes from '../routes/uploadRoutes.js';
import jobDescriptionRoutes from '../routes/jobDescriptionRoutes.js';
import analyzeRoutes from '../routes/analyzeRoutes.js';
import interviewRoutes from '../routes/interviewRoutes.js';
import sessionRoutes from '../routes/sessionRoutes.js';
import exportRoutes from '../routes/exportRoutes.js';
import { errorHandler } from '../middleware/errorHandler.js';
import dotenv from 'dotenv';

dotenv.config();
const api = express.Router();

api.use(cors());
api.use(express.json());

api.use('/upload', uploadRoutes);
api.use('/job-description', jobDescriptionRoutes);
api.use('/analyze', analyzeRoutes);
api.use('/interview', interviewRoutes);
api.use('/session', sessionRoutes);
api.use('/export', exportRoutes);

api.use(errorHandler);

export default api;
