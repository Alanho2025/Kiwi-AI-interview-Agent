/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { formatSuccess } from '../utils/responseFormatter.js';
import {
  appendTranscriptTurn,
  createInterviewQuestion,
  updateSession,
} from '../services/sessionService.js';
import { runTask } from '../services/masterAiService.js';
import { createInterviewLifecycleAuditLog } from '../services/interview/interviewAuditService.js';
import {
  completeInterviewSession,
  ensureInterviewInProgress,
  loadOwnedSessionOrThrow,
  normalizeInterviewAnswer,
  pauseInterviewSession,
  requireSessionId,
  resumeInterviewSession,
  saveInterviewAnswer,
} from '../services/interview/interviewSessionService.js';
import { getOpeningQuestionText, hasAskedOpeningQuestion } from '../services/interviewStateService.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

const tryGenerateReportForCompletedSession = async (req, sessionId) => {
  try {
    const result = await runTask({ taskType: 'generate_report', sessionId });
    logger.info('Report generated after interview completion', getRequestLogMeta(req, {
      sessionId,
      latestStatus: result?.stored?.latestStatus || null,
    }));
    return result;
  } catch (error) {
    logger.error('Report generation failed after interview completion', getRequestLogMeta(req, {
      sessionId,
      error,
    }));
    return null;
  }
};

export const startInterview = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
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
    });
  }

  const updatedSession = await updateSession(sessionId, nextState);
  await createInterviewLifecycleAuditLog({ req, session: updatedSession, actionType: 'start_interview' });

  logger.info('Interview started', getRequestLogMeta(req));
  res.json(formatSuccess('Interview started', { question: openingQuestion, session: updatedSession }));
});

export const replyInterview = asyncHandler(async (req, res) => {
  const { sessionId, answer } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  const normalizedAnswer = normalizeInterviewAnswer(answer);
  await saveInterviewAnswer(sessionId, normalizedAnswer);

  const agentResult = await runTask({
    taskType: 'interview_next_turn',
    sessionId,
    payload: { answer: normalizedAnswer },
  });

  const sessionPatch = agentResult.isComplete
    ? {
        status: 'completed',
        endedAt: new Date().toISOString(),
        lastResumedAt: null,
      }
    : {
        currentQuestionIndex: agentResult.nextQuestionOrder,
      };

  const updatedSession = await updateSession(sessionId, sessionPatch);
  const generatedReport = agentResult.isComplete
    ? await tryGenerateReportForCompletedSession(req, sessionId)
    : null;

  logger.info('Interview reply processed', getRequestLogMeta(req, {
    isComplete: Boolean(agentResult.isComplete),
    nextQuestionOrder: agentResult.nextQuestionOrder || null,
    hasReport: Boolean(generatedReport?.stored?.report),
  }));

  res.json(formatSuccess('Reply processed', {
    nextQuestion: agentResult.nextQuestion,
    rationale: agentResult.rationale,
    retrievalSnapshot: agentResult.retrievalSnapshot,
    isComplete: Boolean(agentResult.isComplete),
    completedBecause: agentResult.completedBecause || null,
    reportStatus: generatedReport?.stored?.latestStatus || null,
    session: updatedSession,
  }));
});

export const repeatQuestion = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  const lastAiMessage = session.transcript.filter((message) => message.role === 'ai').pop();
  res.json(formatSuccess('Question repeated', { question: lastAiMessage?.text }));
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
