/**
 * File responsibility: Route registration module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: ragRoutes should register endpoints and keep route wiring separate from controller logic.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import { importBenchmarkDataset, importInterviewKnowledgeDataset, rebuildSessionIndex, retrieveRagContext } from '../../controllers/ragController.js';

const router = express.Router();

router.post('/import-benchmark', importBenchmarkDataset);
router.post('/import-interview-knowledge', importInterviewKnowledgeDataset);
router.post('/rebuild-session', rebuildSessionIndex);
router.post('/retrieve', retrieveRagContext);

export default router;
