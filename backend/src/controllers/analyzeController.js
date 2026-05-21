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
import { createMatchAnalysisRecord } from '../services/cv/matchAnalysisRecordService.js';
import { getOwnedCvDocumentOrThrow, getOwnedMatchAnalysisOrThrow } from '../services/cv/cvOwnershipService.js';
import { createSession } from '../services/sessionService.js';
import * as authService from '../services/authService.js';
import { createAuditLog } from '../services/auditService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { badRequest } from '../utils/appError.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';
import { recordLocalUsage } from '../services/aiUsageTrackingService.js';

export const matchCV = asyncHandler(async (req, res) => {
  const { cvId, rawJD, jdRubric, settings } = req.body;
  const user = await authService.resolveUserFromRequest(req);

  if (!cvId || (!rawJD && !jdRubric)) {
    throw badRequest('Missing input', 'A selected CV and JD input are required');
  }

  const matchData = await runCvJdMatchAnalysis({ cvId, userId: user.id, rawJD, jdRubric, settings });
  await recordLocalUsage({
    userId: user.id,
    stage: 'cv_jd_match',
    operation: 'local_match',
    metadata: {
      cvId,
      rawJdLength: String(rawJD || '').length,
      hasJdRubric: Boolean(jdRubric),
    },
  });
  const cvDocument = await getOwnedCvDocumentOrThrow({ cvId, userId: user.id });
  const persisted = await createMatchAnalysisRecord({ userId: user.id, cvFileId: cvId, jdStructuredText: rawJD || '', jdRubric, matchData, cvDocument });
  logger.info('CV and JD match completed', getRequestLogMeta(req, {
    strengthsCount: matchData?.strengths?.length || 0,
    gapsCount: matchData?.gaps?.length || 0,
  }));

  res.json(formatSuccess('Match analysis completed', { ...matchData, matchAnalysisId: persisted.matchAnalysisId, evidenceRefs: persisted.evidenceRefs }));
});

const extractTargetRole = ({ jdText = '', jdRubric = null, analysisResult = null } = {}) => {
  const rubricTitle = jdRubric?.jobOverview?.title || jdRubric?.title || '';
  if (rubricTitle) return rubricTitle.trim();
  const firstHeading = String(jdText || '').match(/^#\s+(.+)$/m);
  if (firstHeading?.[1]) return firstHeading[1].trim();
  return String(analysisResult?.jobTitle || '').trim();
};

export const generateInterviewPlan = asyncHandler(async (req, res) => {
  const { cvId, rawJD, jdText, jdRubric, settings, sessionSetup, analysisResult, matchAnalysisId, mode } = req.body;
  const user = await authService.resolveUserFromRequest(req);

  const persistedAnalysis = matchAnalysisId
    ? await getOwnedMatchAnalysisOrThrow({ matchAnalysisId, userId: user.id })
    : null;

  const resolvedAnalysis = persistedAnalysis?.matchAnalysis || analysisResult || {};
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

  res.json(formatSuccess('Interview plan generated', { sessionId: session.id, session }));
});
