/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: jobDescriptionController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { formatSuccess } from '../utils/responseFormatter.js';
import {
  buildStructuredJobDescriptionRubric,
  formatStructuredJobDescription,
} from '../services/jobDescriptionService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireBodyField } from '../utils/controllerHelpers.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

export const paraphraseJD = asyncHandler(async (req, res) => {
  const rawJD = requireBodyField(req, 'rawJD', 'Please provide raw job description text');
  const structuredJDRubric = await buildStructuredJobDescriptionRubric(rawJD);
  const structuredJD = formatStructuredJobDescription(structuredJDRubric);

  logger.info('Job description paraphrased', getRequestLogMeta(req, {
    rubricCriteriaCount: structuredJDRubric?.microCriteria?.length || 0,
  }));

  res.json(formatSuccess('Job description paraphrased successfully', {
    structuredJD,
    structuredJDRubric,
  }));
});
