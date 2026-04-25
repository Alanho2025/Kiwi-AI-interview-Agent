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
import { processVoiceReply } from '../services/voice/voiceOrchestrationService.js';

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
      metadata: {
        stage: 'opening',
        topic: 'self_intro',
        followUpDepth: 0,
        questionCategory: 'opening',
        questionType: 'self_intro',
      },
    });
  }

  const updatedSession = await updateSession(sessionId, user.id, nextState);
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

  const updatedSession = await updateSession(sessionId, user.id, sessionPatch);
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
    interviewerTurn: agentResult.interviewerTurn || null,
    rationale: agentResult.rationale,
    retrievalSnapshot: agentResult.retrievalSnapshot,
    isComplete: Boolean(agentResult.isComplete),
    completedBecause: agentResult.completedBecause || null,
    reportStatus: generatedReport?.stored?.latestStatus || null,
    evaluator: agentResult.evaluatorOutput || null,
    reactTrace: agentResult.reactTrace || null,
    session: updatedSession,
  }));
});


export const replyInterviewWithVoice = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  const result = await processVoiceReply({
    req,
    session,
    userId: user.id,
    file: req.file,
    language: String(req.body?.language || '').trim() || undefined,
    voiceName: String(req.body?.voiceName || '').trim() || undefined,
    durationMs: req.body?.durationMs || null,
    tryGenerateReportForCompletedSession,
  });

  logger.info('Interview voice reply processed', getRequestLogMeta(req, {
    isComplete: Boolean(result.agentResult.isComplete),
    nextQuestionOrder: result.agentResult.nextQuestionOrder || null,
    hasAssistantAudio: Boolean(result.assistantAudio?.storageKey),
  }));

  res.json(formatSuccess('Voice reply processed', {
    nextQuestion: result.agentResult.nextQuestion,
    interviewerTurn: result.agentResult.interviewerTurn || null,
    rationale: result.agentResult.rationale,
    retrievalSnapshot: result.agentResult.retrievalSnapshot,
    isComplete: Boolean(result.agentResult.isComplete),
    completedBecause: result.agentResult.completedBecause || null,
    reportStatus: result.generatedReport?.stored?.latestStatus || null,
    evaluator: result.agentResult.evaluatorOutput || null,
    reactTrace: result.agentResult.reactTrace || null,
    transcription: {
      text: result.transcription.text,
      language: result.transcription.language,
      provider: result.transcription.provider,
      confidence: result.transcription.confidence,
    },
    assistantAudio: result.assistantAudio,
    session: result.updatedSession,
  }));
});

export const repeatQuestion = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  const lastAiMessage = session.transcript.filter((message) => message.role === 'ai').pop();
  const preamble = String(lastAiMessage?.metadata?.preamble || '').trim();
  const question = String(lastAiMessage?.text || '').trim();
  res.json(formatSuccess('Question repeated', {
    question,
    displayText: preamble && question ? `${preamble}

${question}` : question,
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
