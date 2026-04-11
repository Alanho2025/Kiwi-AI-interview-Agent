/**
 * File responsibility: Route registration module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: uploadRoutes should register endpoints and keep route wiring separate from controller logic.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import {
  uploadCV,
  getRecentCVs,
  selectCV,
  rebuildCvProfile,
  deleteCv,
  exportCv,
} from '../../controllers/uploadController.js';
import { uploadMiddleware } from '../../middleware/uploadMiddleware.js';

const router = express.Router();

router.post('/cv', uploadMiddleware, uploadCV);
router.get('/recent-cvs', getRecentCVs);
router.post('/select-cv', selectCV);
router.post('/cv/:cvId/rebuild-profile', rebuildCvProfile);
router.delete('/cv/:cvId', deleteCv);
router.get('/cv/:cvId/export', exportCv);

export default router;
