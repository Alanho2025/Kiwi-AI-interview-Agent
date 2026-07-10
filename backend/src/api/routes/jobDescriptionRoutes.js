/**
 * File responsibility: Route registration module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: jobDescriptionRoutes should register endpoints and keep route wiring separate from controller logic.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import express from 'express';
import { confirmRoleFitReview, paraphraseJD, startCompanyValuesForReviewedJD } from '../../controllers/jobDescriptionController.js';

const router = express.Router();

router.post('/paraphrase', paraphraseJD);
router.put('/role-fit/reviews/:jdFingerprint', confirmRoleFitReview);
router.post('/company-values/enrichment', startCompanyValuesForReviewedJD);

export default router;
