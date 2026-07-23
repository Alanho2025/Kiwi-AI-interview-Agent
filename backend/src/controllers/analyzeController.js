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

import { formatSuccess } from '../utils/responseFormatter.js';
import { runCvJdMatchAnalysis } from '../services/cv/cvAnalysisService.js';
import {
  createMatchAnalysisRecord,
  updateMatchAnalysisPerformanceTrace,
} from '../services/cv/matchAnalysisRecordService.js';
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
import { buildJdQuestionFilter } from '../services/questions/jdQuestionFilterService.js';
import { generateCvQuestionSeeds, getCvQuestionSeeds } from '../services/questions/cvQuestionSeedService.js';
import { prepareInterviewQuestionPool } from '../services/questions/questionPoolPreparationService.js';
import { buildProofStrategyClientSummary } from '../services/questions/proofStrategyClientSummaryService.js';
import { assertUsableMatchForInterviewPlan } from '../services/match/matchPlanGateService.js';
import { createMatchPerformanceTrace } from '../services/match/matchPerformanceTraceService.js';

export const matchCV = asyncHandler(async (req, res) => {
  const { cvId, rawJD, jdRubric, settings } = req.body;
  const user = await authService.resolveUserFromRequest(req);
  const performanceTrace = createMatchPerformanceTrace({
    requestId: req.requestContext?.requestId,
    cvId,
    matchEngine: settings?.matchEngine || process.env.MATCH_ENGINE || 'default',
  });

  if (!cvId || (!rawJD && !jdRubric)) {
    throw badRequest('Missing input', 'A selected CV and JD input are required');
  }

  const matchData = await runCvJdMatchAnalysis({
    cvId,
    userId: user.id,
    rawJD,
    jdRubric,
    settings,
    performanceTrace,
  });
  const cvDocument = await performanceTrace.measure(
    'match_record_cv_reload',
    () => getOwnedCvDocumentOrThrow({ cvId, userId: user.id }),
    { cvId },
  );
  const persisted = await performanceTrace.measure(
    'match_record_persist',
    () => createMatchAnalysisRecord({ userId: user.id, cvFileId: cvId, jdStructuredText: rawJD || '', jdRubric, matchData, cvDocument }),
    { hasWarnings: Boolean((matchData?.warnings || []).length || (cvDocument.parseWarnings || []).length) },
  );
  let jdQuestionFilterStatus = 'created';
  try {
    await performanceTrace.measure('jd_question_filter_build', () => buildJdQuestionFilter({
      userId: user.id,
      cvFileId: cvId,
      jdFingerprint: matchData?.parsedJdProfile?.metadata?.jdFingerprint || jdRubric?.metadata?.jdFingerprint || '',
      rawJD,
      jdRubric: jdRubric || matchData?.parsedJdProfile || null,
      analysisResult: matchData,
      matchAnalysisId: persisted.matchAnalysisId,
      settings,
    }), { matchAnalysisId: persisted.matchAnalysisId });
  } catch (error) {
    jdQuestionFilterStatus = 'failed';
    logger.warn('JD question filter generation failed', getRequestLogMeta(req, {
      userId: user.id,
      cvId,
      matchAnalysisId: persisted.matchAnalysisId,
      error: error.message,
    }));
  }
  const preliminaryTrace = performanceTrace.toJSON({
    matchAnalysisId: persisted.matchAnalysisId,
    cacheHit: Boolean(matchData?.cache?.hit),
    cacheSource: matchData?.cache?.source || null,
    compareAttempts: matchData?.safeguard?.compareAttempts || null,
    jdQuestionFilterStatus,
  });
  await performanceTrace.measure('usage_record', () => recordLocalUsage({
    userId: user.id,
    stage: 'cv_jd_match',
    operation: 'local_match',
    metadata: {
      cvId,
      matchAnalysisId: persisted.matchAnalysisId,
      rawJdLength: String(rawJD || '').length,
      hasJdRubric: Boolean(jdRubric),
      durationMs: preliminaryTrace.totalMs,
      cacheHit: Boolean(matchData?.cache?.hit),
      cacheSource: matchData?.cache?.source || null,
      compareAttempts: matchData?.safeguard?.compareAttempts || null,
      matchEngine: settings?.matchEngine || process.env.MATCH_ENGINE || 'default',
      jdQuestionFilterStatus,
      slowestStep: preliminaryTrace.slowestSteps?.[0]?.step || null,
      slowestStepMs: preliminaryTrace.slowestSteps?.[0]?.durationMs || null,
    },
  }), { matchAnalysisId: persisted.matchAnalysisId });
  const finalPerformanceTrace = performanceTrace.toJSON({
    matchAnalysisId: persisted.matchAnalysisId,
    cacheHit: Boolean(matchData?.cache?.hit),
    cacheSource: matchData?.cache?.source || null,
    compareAttempts: matchData?.safeguard?.compareAttempts || null,
    jdQuestionFilterStatus,
  });
  try {
    await updateMatchAnalysisPerformanceTrace({
      userId: user.id,
      matchAnalysisId: persisted.matchAnalysisId,
      performanceTrace: finalPerformanceTrace,
    });
  } catch (error) {
    logger.warn('Match performance trace persistence failed', getRequestLogMeta(req, {
      userId: user.id,
      cvId,
      matchAnalysisId: persisted.matchAnalysisId,
      error: error.message,
    }));
  }
  logger.info('CV and JD match completed', getRequestLogMeta(req, {
    strengthsCount: matchData?.strengths?.length || 0,
    gapsCount: matchData?.gaps?.length || 0,
    durationMs: finalPerformanceTrace.totalMs,
    cacheHit: finalPerformanceTrace.cacheHit,
    performanceTrace: {
      schemaVersion: finalPerformanceTrace.schemaVersion,
      totalMs: finalPerformanceTrace.totalMs,
      steps: finalPerformanceTrace.steps,
      stepSummary: finalPerformanceTrace.stepSummary,
      slowestSteps: finalPerformanceTrace.slowestSteps,
    },
  }));

  res.json(formatSuccess('Match analysis completed', {
    ...matchData,
    matchAnalysisId: persisted.matchAnalysisId,
    evidenceRefs: persisted.evidenceRefs,
    performanceTrace: finalPerformanceTrace,
  }));
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
