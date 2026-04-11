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
import { compareCvToJobDescription } from '../services/matchService.js';
import { createSession } from '../services/sessionService.js';
import * as authService from '../services/authService.js';
import { createAuditLog } from '../services/auditService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { badRequest } from '../utils/appError.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

export const matchCV = asyncHandler(async (req, res) => {
  const { cvText, rawJD, jdRubric, settings } = req.body;
  if (!cvText || (!rawJD && !jdRubric)) {
    throw badRequest('Missing text', 'CV text and JD input are required');
  }

  const matchData = await compareCvToJobDescription(cvText, rawJD, jdRubric, settings);
  logger.info('CV and JD match completed', getRequestLogMeta(req, {
    strengthsCount: matchData?.strengths?.length || 0,
    gapsCount: matchData?.gaps?.length || 0,
  }));

  res.json(formatSuccess('Match analysis completed', matchData));
});

export const generateInterviewPlan = asyncHandler(async (req, res) => {
  const { cvId, cvText, rawJD, jdText, jdRubric, settings, analysisResult } = req.body;
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

  const session = await createSession({
    userId: user.id,
    cvFileId: cvId || null,
    cvText,
    rawJD: rawJD || '',
    jdText,
    jdRubric: jdRubric || null,
    settings,
    analysisResult,
    targetRole: extractedRole || (jdText ? 'Target Role' : 'General Interview'),
    totalQuestions: 8,
    currentQuestionIndex: 1,
    candidateName: analysisResult?.candidateName || 'Candidate',
  });

  await createAuditLog({
    actorUserId: user.id,
    targetUserId: user.id,
    sessionId: session.id,
    actionType: 'create_interview_session',
    resourceType: 'interview_session',
    resourceId: session.id,
    metadata: { cvId: cvId || null, targetRole: session.targetRole },
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
