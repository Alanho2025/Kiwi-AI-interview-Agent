import { formatSuccess } from '../utils/responseFormatter.js';
import { appendTranscriptTurn, createInterviewQuestion, updateSession } from '../services/sessionService.js';
import { warmAdaptiveSession } from '../services/masterAiService.js';
import { createInterviewLifecycleAuditLog } from '../services/interview/interviewAuditService.js';
import {
  completeInterviewSession,
  ensureInterviewInProgress,
  loadOwnedSessionOrThrow,
  pauseInterviewSession,
  reconcileInterviewQuestionPool,
  requireSessionId,
  resumeInterviewSession,
} from '../services/interview/interviewSessionService.js';
import { getOpeningQuestionText, hasAskedOpeningQuestion } from '../services/interviewStateService.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';
import { createLatencyTrace } from '../utils/latencyTrace.js';
import { tryGenerateReportForCompletedSession } from './interviewControllerUtils.js';

export const startInterview = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  await reconcileInterviewQuestionPool(session);
  const openingQuestion = getOpeningQuestionText(session);
  const nextState = {
    status: 'in_progress',
    lastResumedAt: new Date().toISOString(),
  };

  if (!hasAskedOpeningQuestion(session)) {
    const questionId = await createInterviewQuestion({
      sessionId,
      questionOrder: 1,
      questionType: 'self_intro',
      sourceType: 'template',
      questionText: openingQuestion,
      basedOnCv: false,
      basedOnJd: false,
    });
    await appendTranscriptTurn(sessionId, {
      role: 'ai',
      text: openingQuestion,
      timestamp: new Date().toISOString(),
      questionId,
      metadata: {
        rootQuestionId: questionId,
        questionId,
        stage: 'opening',
        topic: 'self_intro',
        followUpDepth: 0,
        questionCategory: 'opening',
        questionType: 'self_intro',
        turnKind: 'root_question',
        turnType: 'interview_question',
        countsAsQuestion: true,
      },
    });
  }

  const updatedSession = await updateSession(sessionId, user.id, nextState);
  await createInterviewLifecycleAuditLog({ req, session: updatedSession, actionType: 'start_interview' });

  logger.info('Interview started', getRequestLogMeta(req));
  res.json(formatSuccess('Interview started', { question: openingQuestion, session: updatedSession }));
});

export const warmAdaptiveInterview = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  const trace = createLatencyTrace('warm_adaptive_session', {
    sessionId: session.id,
    userId: user.id,
  });
  const result = await warmAdaptiveSession({ sessionId: session.id, trace });
  const latency = trace.toJSON();

  logger.info('Adaptive interview session warmed', getRequestLogMeta(req, {
    sessionId: session.id,
    latency,
  }));

  res.json(formatSuccess('Adaptive session warmed', {
    ...result,
    latency,
  }));
});

export const pauseInterview = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  const updatedSession = await pauseInterviewSession(session);
  logger.info('Interview paused', getRequestLogMeta(req));
  res.json(formatSuccess('Interview paused', { session: updatedSession }));
});

export const resumeInterview = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  const updatedSession = await resumeInterviewSession(session);
  logger.info('Interview resumed', getRequestLogMeta(req));
  res.json(formatSuccess('Interview resumed', { session: updatedSession }));
});

export const endInterview = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  const updatedSession = await completeInterviewSession(session);
  await createInterviewLifecycleAuditLog({ req, session: updatedSession, actionType: 'end_interview' });
  const generatedReport = await tryGenerateReportForCompletedSession(req, sessionId);

  logger.info('Interview ended', getRequestLogMeta(req, {
    hasReport: Boolean(generatedReport?.stored?.report),
  }));
  res.json(formatSuccess('Interview ended', {
    session: updatedSession,
    reportStatus: generatedReport?.stored?.latestStatus || null,
  }));
});
