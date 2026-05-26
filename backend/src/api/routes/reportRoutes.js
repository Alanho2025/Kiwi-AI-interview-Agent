/**
 * File responsibility: Route registration module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportRoutes should register endpoints and keep route wiring separate from controller logic.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import { generateReport, getReport, qaReport, exportReport } from '../../controllers/reportController.js';
import { qaRewriteReport } from '../../controllers/reportQaRewriteController.js';

const router = express.Router();

router.post('/generate', generateReport);
router.post('/qa', qaRewriteReport);
router.post('/qa-check', qaReport);
router.get('/:sessionId', getReport);
router.post('/:sessionId/export', exportReport);

export default router;