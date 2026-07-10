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
import { buildRoleFitProfile, validateRoleFitReviewInput } from '../services/jobDescription/roleFitProfileBuilder.js';
import { badRequest } from '../utils/appError.js';
import {
  confirmCompanyRoleFitReview,
  saveCompanyRoleFitDraft,
  getCompanyValuesProfilesByUserId,
} from '../services/company/companyValuesRepository.js';
import { captureUrlContent } from '../services/jobDescription/urlCaptureService.js';

export const paraphraseJD = asyncHandler(async (req, res) => {
  const rawJD = requireBodyField(req, 'rawJD', 'Please provide raw job description text');
  const user = await resolveUserFromRequest(req);
  const companyWebsiteUrl = String(req.body?.companyWebsiteUrl || '').trim();
  const userCompanyContext = String(req.body?.userCompanyContext || '').trim();

  let targetRawJD = rawJD.trim();
  let sourceUrl = '';

  const isUrl = /^https?:\/\//i.test(targetRawJD);
  if (isUrl) {
    logger.info(`URL detected in paraphraseJD: ${targetRawJD}. Capturing content...`);
    const captured = await captureUrlContent(targetRawJD);
    targetRawJD = captured.visibleText;
    sourceUrl = captured.finalUrl;
  }

  const parsedRubric = await buildGuardedStructuredJobDescriptionRubric(targetRawJD);
  const roleFit = buildRoleFitProfile({ rawJD: targetRawJD, rubric: parsedRubric, companyWebsiteUrl, userCompanyContext });
  if (roleFit.companyContext.status !== 'ready') {
    throw badRequest(
      'Missing company context',
      'Provide a valid company website URL or manual company context before summarising the JD.',
      { securityFlags: roleFit.securityFlags }
    );
  }
  const draftRubric = {
    ...parsedRubric,
    jobOverview: {
      ...(parsedRubric.jobOverview || {}),
      ...(roleFit.companyContext.websiteUrl ? { companyWebsiteUrl: roleFit.companyContext.websiteUrl } : {}),
    },
    roleFit,
  };
  const { jdFingerprint } = extractCompanyValuesContextFromJd({
    rawJD: targetRawJD,
    jdRubric: draftRubric,
    companyWebsiteUrl: roleFit.companyContext.websiteUrl,
  });
  const roleFitWithIdentity = { ...roleFit, jdFingerprint };
  const structuredJDRubric = {
    ...draftRubric,
    roleFit: roleFitWithIdentity,
    metadata: {
      ...(draftRubric.metadata || {}),
      jdFingerprint,
    },
  };
  await saveCompanyRoleFitDraft({
    userId: user.id,
    jdFingerprint,
    roleFitProfile: roleFitWithIdentity,
    rawJD: targetRawJD,
    sourceUrl,
  });
  const structuredJD = formatStructuredJobDescription(structuredJDRubric);
  await recordLocalUsage({
    userId: user.id,
    stage: 'jd_parse',
    operation: 'local_parse',
    metadata: {
      rawTextLength: targetRawJD.length,
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
    rawJD: targetRawJD, // Return the extracted text to let front-end update state
    sourceUrl,
  }));
});

export const confirmRoleFitReview = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const jdFingerprint = String(req.params?.jdFingerprint || '').trim();
  const roleFitProfile = req.body?.roleFit || req.body?.jdRubric?.roleFit;
  const baseVersion = Number(req.body?.baseVersion);
  if (!jdFingerprint || !roleFitProfile) {
    throw badRequest('Missing role-fit review', 'A JD fingerprint and role-fit draft are required.');
  }
  const validation = validateRoleFitReviewInput(roleFitProfile);
  if (!validation.valid) {
    throw badRequest(
      'Invalid role-fit review',
      'Review edits contain missing or unsafe company and role context.',
      { errorCodes: validation.errorCodes }
    );
  }

  const saved = await confirmCompanyRoleFitReview({
    userId: user.id,
    jdFingerprint,
    baseVersion,
    roleFitProfile,
    jdRubric: req.body?.jdRubric,
  });

  logger.info('Role-fit JD review confirmed', getRequestLogMeta(req, {
    jdFingerprint,
    reviewVersion: saved?.roleFitReviewVersion,
  }));

  res.json(formatSuccess('Role-fit review confirmed', {
    jdFingerprint,
    roleFit: saved?.roleFitProfile || roleFitProfile,
    jdRubric: saved?.jdRubric || req.body?.jdRubric || null,
    reviewVersion: saved?.roleFitReviewVersion || baseVersion + 1,
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

export const getSavedJobDescriptions = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const profiles = await getCompanyValuesProfilesByUserId(user.id);

  // Map each saved CompanyValuesProfile into a client-friendly JD format
  const savedJDs = profiles.map(profile => {
    // Reconstruct title from rubric or company name if available
    const rubric = profile.jdRubric || {};
    const title = rubric.jobOverview?.title || rubric.title || rubric.jobTitle || profile.roleFitProfile?.companyUnderstanding?.companyName || 'Saved Job';
    
    return {
      jdFingerprint: profile.jdFingerprint,
      title: profile.companyName ? `${title} at ${profile.companyName}` : title,
      companyName: profile.companyName || '',
      location: profile.location || '',
      websiteUrl: profile.websiteUrl || '',
      rawJD: profile.rawJD || '',
      sourceUrl: profile.sourceUrl || '',
      jdRubric: rubric,
      status: profile.roleFitReviewStatus || 'unreviewed',
      updatedAt: profile.updatedAt,
    };
  });

  res.json(formatSuccess('Saved job descriptions retrieved successfully', { savedJDs }));
});
