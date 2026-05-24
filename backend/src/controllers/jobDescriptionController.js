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
  buildGuardedStructuredJobDescriptionRubric,
  formatStructuredJobDescription,
} from '../services/jobDescriptionService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { requireBodyField } from '../utils/controllerHelpers.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { recordLocalUsage } from '../services/aiUsageTrackingService.js';
import { extractCompanyValuesContextFromJd } from '../services/company/companyValuesFingerprintService.js';
import { startCompanyValuesEnrichment } from '../services/company/companyValuesEnrichmentService.js';

export const paraphraseJD = asyncHandler(async (req, res) => {
  const rawJD = requireBodyField(req, 'rawJD', 'Please provide raw job description text');
  const user = await resolveUserFromRequest(req);
  const structuredJDRubric = await buildGuardedStructuredJobDescriptionRubric(rawJD);
  const structuredJD = formatStructuredJobDescription(structuredJDRubric);
  await recordLocalUsage({
    userId: user.id,
    stage: 'jd_parse',
    operation: 'local_parse',
    metadata: {
      rawTextLength: rawJD.length,
      safeguardStatus: structuredJDRubric?.safeguard?.finalStatus || null,
    },
  });

  logger.info('Job description paraphrased', getRequestLogMeta(req, {
    rubricCriteriaCount: structuredJDRubric?.microCriteria?.length || 0,
    safeguardStatus: structuredJDRubric?.safeguard?.finalStatus,
  }));

  res.json(formatSuccess('Job description paraphrased successfully', {
    structuredJD,
    structuredJDRubric,
    safeguard: structuredJDRubric.safeguard,
  }));
});

export const startCompanyValuesForReviewedJD = asyncHandler(async (req, res) => {
  const rawJD = requireBodyField(req, 'rawJD', 'Please provide raw job description text');
  const user = await resolveUserFromRequest(req);
  const jdRubric = req.body?.jdRubric || {};
  const context = extractCompanyValuesContextFromJd({
    rawJD,
    jdRubric,
    companyWebsiteUrl: req.body?.companyWebsiteUrl,
  });

  const profile = await startCompanyValuesEnrichment({
    userId: user.id,
    jdFingerprint: context.jdFingerprint,
    companyName: context.companyName,
    location: context.location,
    jdText: context.jdText,
    manualWebsiteUrl: context.websiteUrl,
  });

  logger.info('Company values enrichment queued for reviewed JD', getRequestLogMeta(req, {
    jdFingerprint: context.jdFingerprint,
    companyName: context.companyName,
    hasManualWebsiteUrl: Boolean(context.websiteUrl),
  }));

  res.json(formatSuccess('Company values enrichment started', {
    jdFingerprint: context.jdFingerprint,
    status: profile?.status || 'pending',
    companyName: context.companyName,
    hasCompanyName: Boolean(context.companyName),
    hasManualWebsiteUrl: Boolean(context.websiteUrl),
    expectedSearchProvider: context.websiteUrl ? 'manual_website' : 'serper',
    searchQueued: Boolean(context.companyName || context.websiteUrl),
    fallbackReason: context.companyName || context.websiteUrl ? null : 'missing_company_name',
  }));
});
