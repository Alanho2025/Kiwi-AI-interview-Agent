/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: analyzeController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'node:crypto';

import { formatSuccess } from '../utils/responseFormatter.js';
import { getOwnedCvDocumentOrThrow, getOwnedMatchAnalysisOrThrow } from '../services/cv/cvOwnershipService.js';
import { createSession, getOwnedSessionById } from '../services/sessionService.js';
import * as authService from '../services/authService.js';
import { createAuditLog } from '../services/auditService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { badRequest } from '../utils/appError.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';
import { recordLocalUsage } from '../services/aiUsageTrackingService.js';
import {
  extractCompanyValuesContextFromJd,
  shouldStartCompanyValuesEnrichment,
} from '../services/company/companyValuesFingerprintService.js';
import {
  attachCompanyValuesProfileToSession,
  getCompanyValuesProfileByFingerprint,
} from '../services/company/companyValuesRepository.js';
import { startCompanyValuesEnrichment } from '../services/company/companyValuesEnrichmentService.js';
import { generateCvQuestionSeeds, getCvQuestionSeeds } from '../services/questions/cvQuestionSeedService.js';
import { prepareInterviewQuestionPool } from '../services/questions/questionPoolPreparationService.js';
import { buildProofStrategyClientSummary } from '../services/questions/proofStrategyClientSummaryService.js';
import { assertUsableMatchForInterviewPlan } from '../services/match/matchPlanGateService.js';
import { executeCanonicalMatch } from '../services/match/matchAnalysisExecutionService.js';
import {
  createMatchSseWriter,
  createMatchStreamReporter,
} from '../services/match/matchStreamEventService.js';

export const matchCV = asyncHandler(async (req, res) => {
  const { cvId, rawJD, jdRubric, settings } = req.body;
  const user = await authService.resolveUserFromRequest(req);

  if (!cvId || (!rawJD && !jdRubric)) {
    throw badRequest('Missing input', 'A selected CV and JD input are required');
  }

  const matchData = await executeCanonicalMatch({
    cvId,
    userId: user.id,
    rawJD,
    jdRubric,
    settings,
    requestId: req.requestContext?.requestId,
    requestMeta: getRequestLogMeta(req, {}),
  });

  res.json(formatSuccess('Match analysis completed', matchData));
});

const INPUT_ERROR_CODES = new Set(['NO_CONTENT', 'TOO_SHORT', 'TOO_LONG', 'CORRUPTED']);

const buildSafeStreamFailure = (error, failedStage = 'evidence_match') => {
  const code = INPUT_ERROR_CODES.has(error?.code)
    ? error.code
    : error?.code === 'PERSISTENCE_FAILED'
      ? 'PERSISTENCE_FAILED'
      : error?.code === 'BAD_REQUEST'
        ? 'ROLE_FIT_REVIEW_REQUIRED'
        : 'MATCH_FAILED';
  const repairTarget = INPUT_ERROR_CODES.has(code)
    ? /^CV\b/i.test(error?.message || '') ? 'cv' : /^JD\b/i.test(error?.message || '') ? 'jd' : 'match'
    : code === 'ROLE_FIT_REVIEW_REQUIRED' ? 'jd' : null;

  return {
    code,
    message: error?.expose === false
      ? 'Match analysis could not finish. Try again.'
      : error?.details || error?.message || 'Match analysis could not finish. Try again.',
    retryable: !INPUT_ERROR_CODES.has(code) && code !== 'ROLE_FIT_REVIEW_REQUIRED',
    failedStage,
    repairTarget,
  };
};

export const matchCVStream = asyncHandler(async (req, res) => {
  const { cvId, rawJD, jdRubric, settings } = req.body;
  const user = await authService.resolveUserFromRequest(req);

  if (!cvId || (!rawJD && !jdRubric)) {
    throw badRequest('Missing input', 'A selected CV and JD input are required');
  }

  const requestId = req.get('X-Match-Request-Id')
    || req.requestContext?.requestId
    || crypto.randomUUID();

  res.status(200);
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();

  const reporter = createMatchStreamReporter({
    requestId,
    writeEvent: createMatchSseWriter(res),
  });
  reporter.start();

  try {
    const matchData = await executeCanonicalMatch({
      cvId,
      userId: user.id,
      rawJD,
      jdRubric,
      settings,
      requestId,
      requestMeta: getRequestLogMeta(req, {}),
      progressReporter: reporter,
    });
    reporter.complete({
      matchAnalysisId: matchData.matchAnalysisId,
      evidenceRefs: matchData.evidenceRefs,
      result: matchData,
      performanceTrace: matchData.performanceTrace,
    });
  } catch (error) {
    logger.warn('CV and JD match stream failed', getRequestLogMeta(req, {
      userId: user.id,
      cvId,
      requestId,
      code: error?.code || 'MATCH_FAILED',
    }));
    reporter.fail(buildSafeStreamFailure(error));
  } finally {
    res.end();
  }
});

const extractTargetRole = ({ jdText = '', jdRubric = null, analysisResult = null } = {}) => {
  const rubricTitle = jdRubric?.jobOverview?.title || jdRubric?.title || '';
  if (rubricTitle) return rubricTitle.trim();
  const firstHeading = String(jdText || '').match(/^#\s+(.+)$/m);
  if (firstHeading?.[1]) return firstHeading[1].trim();
  return String(analysisResult?.jobTitle || '').trim();
};

const hasReliableCompanyValuesProfile = (profile = null) => {
  if (!profile || profile.status !== 'ready') return false;
  return ['manual', 'official_website'].includes(profile.source);
};

const ensureCvQuestionSeedsForPlan = async ({ userId, cvId, settings, requestMeta }) => {
  if (!cvId) return [];
  try {
    const existingSeeds = await getCvQuestionSeeds({ userId, cvFileId: cvId, status: 'active' });
    if (existingSeeds.length) return existingSeeds;
    const cvDocument = await getOwnedCvDocumentOrThrow({ cvId, userId });
    return generateCvQuestionSeeds({
      userId,
      cvFileId: cvId,
      cvProfile: cvDocument.cvProfile,
      normalizedText: cvDocument.normalizedText,
      settings,
    });
  } catch (error) {
    logger.warn('CV question seed recovery failed during plan generation', {
      ...requestMeta,
      userId,
      cvId,
      error: error.message,
    });
    return [];
  }
};

export const generateInterviewPlan = asyncHandler(async (req, res) => {
  const { cvId, rawJD, jdText, jdRubric, settings, sessionSetup, analysisResult, matchAnalysisId, mode } = req.body;
  const user = await authService.resolveUserFromRequest(req);

  const persistedAnalysis = matchAnalysisId
    ? await getOwnedMatchAnalysisOrThrow({ matchAnalysisId, userId: user.id })
    : null;

  const resolvedAnalysis = persistedAnalysis?.matchAnalysis || analysisResult || {};
  assertUsableMatchForInterviewPlan(resolvedAnalysis);
  const companyValuesContext = extractCompanyValuesContextFromJd({
    rawJD: rawJD || jdText || '',
    jdRubric: jdRubric || resolvedAnalysis?.parsedJdProfile || {},
  });
  const session = await createSession({
    userId: user.id,
    cvFileId: cvId || null,
    rawJD: rawJD || '',
    jdText,
    jdRubric: jdRubric || null,
    settings,
    analysisResult: resolvedAnalysis,
    matchAnalysisId: matchAnalysisId || null,
    evidenceRefs: persistedAnalysis?.evidenceRefs || resolvedAnalysis?.evidenceRefs || [],
    targetRole: extractTargetRole({ jdText, jdRubric, analysisResult: resolvedAnalysis }) || null,
    mode,
    sessionSetup,
    totalQuestions: sessionSetup?.questionLimit || settings?.questionLimit || 8,
    currentQuestionIndex: 1,
    candidateName: resolvedAnalysis?.candidateName || 'Candidate',
  });
  await ensureCvQuestionSeedsForPlan({
    userId: user.id,
    cvId,
    settings,
    requestMeta: getRequestLogMeta(req, {}),
  });
  let preparedQuestionPool = [];
  let questionPoolReadiness = null;
  try {
    const preparation = await prepareInterviewQuestionPool({
      userId: user.id,
      sessionId: session.id,
      cvFileId: cvId || null,
      matchAnalysisId: matchAnalysisId || null,
      jdFingerprint: companyValuesContext.jdFingerprint,
      analysisResult: resolvedAnalysis,
      jdRubric: jdRubric || resolvedAnalysis?.parsedJdProfile || null,
      settings,
    });
    preparedQuestionPool = preparation.items;
    questionPoolReadiness = preparation.readiness;
  } catch (error) {
    logger.warn('Prepared interview question pool composition failed', getRequestLogMeta(req, {
      userId: user.id,
      sessionId: session.id,
      matchAnalysisId: matchAnalysisId || null,
      error: error.message,
    }));
  }
  const existingCompanyValuesProfile = await getCompanyValuesProfileByFingerprint({
    userId: user.id,
    jdFingerprint: companyValuesContext.jdFingerprint,
  });
  const shouldStartEnrichment = shouldStartCompanyValuesEnrichment({
    companyValuesContext,
    jdRubric: jdRubric || resolvedAnalysis?.parsedJdProfile || {},
  });
  const hasReliableProfile = hasReliableCompanyValuesProfile(existingCompanyValuesProfile);

  logger.info('Company values context resolved', getRequestLogMeta(req, {
    userId: user.id,
    sessionId: session.id,
    companyName: companyValuesContext.companyName || null,
    websiteUrl: companyValuesContext.websiteUrl || null,
    inputTrustLevel: jdRubric?.metadata?.inputTrustLevel || resolvedAnalysis?.parsedJdProfile?.metadata?.inputTrustLevel || null,
    hasExistingCompanyValuesProfile: Boolean(existingCompanyValuesProfile),
    existingCompanyValuesSource: existingCompanyValuesProfile?.source || null,
    existingCompanyValuesStatus: existingCompanyValuesProfile?.status || null,
    existingCompanyValuesFallbackReason: existingCompanyValuesProfile?.fallbackReason || null,
    hasReliableCompanyValuesProfile: hasReliableProfile,
    shouldStartEnrichment,
  }));

  if (hasReliableProfile) {
    await attachCompanyValuesProfileToSession({
      userId: user.id,
      jdFingerprint: companyValuesContext.jdFingerprint,
      sessionId: session.id,
    });
  } else if (shouldStartEnrichment) {
    await startCompanyValuesEnrichment({
      userId: user.id,
      jdFingerprint: companyValuesContext.jdFingerprint,
      sessionId: session.id,
      companyName: companyValuesContext.companyName,
      location: companyValuesContext.location,
      jdText: companyValuesContext.jdText,
      manualWebsiteUrl: companyValuesContext.websiteUrl,
    });
  } else if (existingCompanyValuesProfile) {
    await attachCompanyValuesProfileToSession({
      userId: user.id,
      jdFingerprint: companyValuesContext.jdFingerprint,
      sessionId: session.id,
    });
  }
  await Promise.all([
    recordLocalUsage({
      userId: user.id,
      sessionId: session.id,
      stage: 'cv_parse',
      operation: 'local_parse',
      metadata: { cvId: cvId || null, source: 'session_creation' },
    }),
    recordLocalUsage({
      userId: user.id,
      sessionId: session.id,
      stage: 'jd_parse',
      operation: 'local_parse',
      metadata: {
        rawJdLength: String(rawJD || jdText || '').length,
        hasJdRubric: Boolean(jdRubric),
        source: 'session_creation',
      },
    }),
    recordLocalUsage({
      userId: user.id,
      sessionId: session.id,
      stage: 'cv_jd_match',
      operation: 'local_match',
      metadata: {
        matchAnalysisId: matchAnalysisId || null,
        matchScore: resolvedAnalysis?.matchScore || null,
        source: 'session_creation',
      },
    }),
  ]);

  await createAuditLog({
    actorUserId: user.id,
    targetUserId: user.id,
    sessionId: session.id,
    actionType: 'create_interview_session',
    resourceType: 'interview_session',
    resourceId: session.id,
    metadata: { cvId: cvId || null, targetRole: session.targetRole, matchAnalysisId: matchAnalysisId || null, mode: session.mode || mode || 'text' },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.info('Interview session created from analysis flow', getRequestLogMeta(req, {
    userId: user.id,
    sessionId: session.id,
    targetRole: session.targetRole,
  }));

  const updatedSession = await getOwnedSessionById(session.id, user.id);
  const sourceCounts = preparedQuestionPool.reduce((counts, item) => {
    const source = item.sourceStage || item.sourceType || 'unknown';
    counts[source] = (counts[source] || 0) + 1;
    return counts;
  }, {});
  res.json(formatSuccess('Interview plan generated', {
    sessionId: session.id,
    session: updatedSession || session,
    questionPool: {
      prepared: preparedQuestionPool.length > 0,
      count: preparedQuestionPool.length,
      sources: sourceCounts,
      readiness: questionPoolReadiness?.readiness || questionPoolReadiness?.status || 'degraded',
      degradedReason: questionPoolReadiness?.degradedReason || (preparedQuestionPool.length ? null : 'question_pool_preparation_failed'),
      proofStrategy: buildProofStrategyClientSummary({
        readiness: questionPoolReadiness || {},
        poolItems: preparedQuestionPool,
      }),
    },
  }));
});
