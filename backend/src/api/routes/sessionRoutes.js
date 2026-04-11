/**
 * File responsibility: Route registration module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionRoutes should register endpoints and keep route wiring separate from controller logic.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import { saveSession, getSession, getSessionHistory, resumeSession } from '../../controllers/sessionController.js';

const router = express.Router();

router.post('/save', saveSession);
router.get('/history', getSessionHistory);
router.get('/:sessionId', getSession);
router.post('/resume', resumeSession);

export default router;
