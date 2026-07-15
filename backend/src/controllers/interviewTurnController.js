import { formatSuccess } from '../utils/responseFormatter.js';
import { updateSession } from '../services/sessionService.js';
import { runTask } from '../services/masterAiService.js';
import {
  applyElapsedSeconds,
  ensureInterviewInProgress,
  loadOwnedSessionOrThrow,
  normalizeInterviewAnswer,
  requireSessionId,
  saveInterviewAnswer,
} from '../services/interview/interviewSessionService.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';
import { withSessionTurnLock } from '../utils/sessionTurnLock.js';
import { tryGenerateReportForCompletedSession } from './interviewControllerUtils.js';
import { buildLiveInterviewTurnResponse } from '../services/interview/liveInterviewPayloadService.js';

export const replyInterview = asyncHandler(async (req, res) => {
  const { sessionId, answer, clientTurnId = null } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  const { agentResult, updatedSession, generatedReport } = await withSessionTurnLock(sessionId, async () => {
    const cleanAnswer = normalizeInterviewAnswer(answer);
    await saveInterviewAnswer(sessionId, cleanAnswer);

    const nextTurnResult = await runTask({
      taskType: 'interview_next_turn',
      sessionId,
      payload: { answer: cleanAnswer, clientTurnId },
    });

    const elapsedSession = applyElapsedSeconds(session);
    const sessionPatch = nextTurnResult.isComplete
      ? {
          status: 'completed',
          endedAt: new Date().toISOString(),
          lastResumedAt: null,
          elapsedSeconds: elapsedSession.elapsedSeconds,
          completedBecause: nextTurnResult.completedBecause || 'question_limit_reached',
        }
      : {
          currentQuestionIndex: nextTurnResult.nextQuestionOrder,
        };

    const nextSession = await updateSession(sessionId, user.id, sessionPatch);
    const report = nextTurnResult.isComplete
      ? await tryGenerateReportForCompletedSession(req, sessionId)
      : null;

    return {
      normalizedAnswer: cleanAnswer,
      agentResult: nextTurnResult,
      updatedSession: nextSession,
      generatedReport: report,
    };
  });

  logger.info('Interview reply processed', getRequestLogMeta(req, {
    isComplete: Boolean(agentResult.isComplete),
    nextQuestionOrder: agentResult.nextQuestionOrder || null,
    hasReport: Boolean(generatedReport?.stored?.report),
  }));

  res.json(formatSuccess('Reply processed', buildLiveInterviewTurnResponse({
    agentResult,
    updatedSession,
    generatedReport,
  })));
});

export const repeatQuestion = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  const lastAiMessage = session.transcript.filter((message) => message.role === 'ai').pop();
  const question = String(lastAiMessage?.text || '').trim();
  res.json(formatSuccess('Question repeated', {
    question,
    displayText: question,
  }));
});
