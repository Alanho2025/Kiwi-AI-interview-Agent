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

export const matchCV = asyncHandler(async (req, res) => {
  const { cvId, rawJD, jdRubric, settings } = req.body;
  const user = await authService.resolveUserFromRequest(req);

  if (!cvId || (!rawJD && !jdRubric)) {
    throw badRequest('Missing input', 'A selected CV and JD input are required');
  }

  const matchData = await runCvJdMatchAnalysis({ cvId, userId: user.id, rawJD, jdRubric, settings });
  const cvDocument = await getOwnedCvDocumentOrThrow({ cvId, userId: user.id });
  const persisted = await createMatchAnalysisRecord({ userId: user.id, cvFileId: cvId, jdStructuredText: rawJD || '', jdRubric, matchData, cvDocument });
  logger.info('CV and JD match completed', getRequestLogMeta(req, {
    strengthsCount: matchData?.strengths?.length || 0,
    gapsCount: matchData?.gaps?.length || 0,
  }));

  res.json(formatSuccess('Match analysis completed', { ...matchData, matchAnalysisId: persisted.matchAnalysisId, evidenceRefs: persisted.evidenceRefs }));
});

export const generateInterviewPlan = asyncHandler(async (req, res) => {
  const { cvId, rawJD, jdText, jdRubric, settings, analysisResult, matchAnalysisId } = req.body;
  const user = await authService.resolveUserFromRequest(req);

  let extractedRole = '';
  if (jdText) {
    const match = jdText.match(/1\. Job Title:\s*(.*)/i);
    if (match?.[1]) {
      extractedRole = match[1].trim();
    }
  }

  if (!extractedRole && analysisResult?.jobTitle) {
    extractedRole = analysisResult.jobTitle;
  }

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
    targetRole: extractedRole || (jdText ? 'Target Role' : 'General Interview'),
    totalQuestions: 8,
    currentQuestionIndex: 1,
    candidateName: resolvedAnalysis?.candidateName || 'Candidate',
  });

  await createAuditLog({
    actorUserId: user.id,
    targetUserId: user.id,
    sessionId: session.id,
    actionType: 'create_interview_session',
    resourceType: 'interview_session',
    resourceId: session.id,
    metadata: { cvId: cvId || null, targetRole: session.targetRole, matchAnalysisId: matchAnalysisId || null },
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
