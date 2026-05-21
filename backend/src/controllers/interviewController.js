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

import { formatError, formatSuccess } from '../utils/responseFormatter.js';
import {
  appendTranscriptTurn,
  createInterviewQuestion,
  updateSession,
} from '../services/sessionService.js';
import { runTask, warmAdaptiveSession } from '../services/masterAiService.js';
import { createInterviewLifecycleAuditLog } from '../services/interview/interviewAuditService.js';
import {
  applyElapsedSeconds,
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
import { createLatencyTrace } from '../utils/latencyTrace.js';
import { processRealtimeVoiceTurn } from '../services/voice/realtimeVoiceTurnService.js';
import { synthesizeSpeech } from '../services/voice/azureSpeechService.js';
import { withSessionTurnLock } from '../utils/sessionTurnLock.js';

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

export const replyInterview = asyncHandler(async (req, res) => {
  const { sessionId, answer } = req.body;
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
      payload: { answer: cleanAnswer },
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


export const replyInterviewWithRealtimeVoice = asyncHandler(async (req, res) => {
  const { sessionId, transcriptText } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  const result = await withSessionTurnLock(sessionId, () => processRealtimeVoiceTurn({
    req,
    session,
    userId: user.id,
    transcriptText,
    language: String(req.body?.language || '').trim() || undefined,
    asrConfidence: req.body?.asrConfidence ?? null,
    asrSource: String(req.body?.asrSource || '').trim() || undefined,
    voiceName: String(req.body?.voiceName || '').trim() || undefined,
    inputMode: String(req.body?.inputMode || '').trim() || undefined,
    vad: req.body?.vad || null,
    tryGenerateReportForCompletedSession,
  }));

  logger.info('Interview realtime voice reply processed', getRequestLogMeta(req, {
    isComplete: Boolean(result.agentResult.isComplete),
    nextQuestionOrder: result.agentResult.nextQuestionOrder || null,
    hasAssistantAudio: Boolean(result.assistantAudio?.base64),
    latency: result.latency,
  }));

  res.json(formatSuccess('Realtime voice reply processed', {
    nextQuestion: result.agentResult.nextQuestion,
    interviewerTurn: result.agentResult.interviewerTurn || null,
    rationale: result.agentResult.rationale,
    retrievalSnapshot: result.agentResult.retrievalSnapshot,
    isComplete: Boolean(result.agentResult.isComplete),
    completedBecause: result.agentResult.completedBecause || null,
    reportStatus: result.generatedReport?.stored?.latestStatus || null,
    evaluator: result.agentResult.evaluatorOutput || null,
    reactTrace: result.agentResult.reactTrace || null,
    transcription: result.transcription,
    assistantAudio: result.assistantAudio,
    latency: result.latency,
    session: result.updatedSession,
  }));
});

export const replyInterviewWithRealtimeVoiceStream = asyncHandler(async (req, res) => {
  const { sessionId, transcriptText } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  const voiceName = String(req.body?.voiceName || '').trim() || undefined;

  const onSentence = async (text, index) => {
    try {
      const synthesis = await synthesizeSpeech({
        text,
        voiceName,
        usageContext: {
          userId: user.id,
          sessionId,
          stage: 'interview',
          source: 'realtime_voice_turn_stream',
        },
      });
      const payload = {
        type: 'audio',
        base64: synthesis.audioBuffer.toString('base64'),
        index,
        text,
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (err) {
      logger.error('Failed to synthesize sentence stream', { error: err });
    }
  };

  const result = await withSessionTurnLock(sessionId, () => processRealtimeVoiceTurn({
    req,
    session,
    userId: user.id,
    transcriptText,
    language: String(req.body?.language || '').trim() || undefined,
    asrConfidence: req.body?.asrConfidence ?? null,
    asrSource: String(req.body?.asrSource || '').trim() || undefined,
    voiceName,
    inputMode: String(req.body?.inputMode || '').trim() || undefined,
    vad: req.body?.vad || null,
    tryGenerateReportForCompletedSession,
    onSentence,
  }));

  logger.info('Interview realtime voice stream reply processed', getRequestLogMeta(req, {
    isComplete: Boolean(result.agentResult.isComplete),
    latency: result.latency,
  }));

  res.write(`data: ${JSON.stringify({
    type: 'done',
    result: {
      nextQuestion: result.agentResult.nextQuestion,
      interviewerTurn: result.agentResult.interviewerTurn || null,
      rationale: result.agentResult.rationale,
      retrievalSnapshot: result.agentResult.retrievalSnapshot,
      isComplete: Boolean(result.agentResult.isComplete),
      completedBecause: result.agentResult.completedBecause || null,
      reportStatus: result.generatedReport?.stored?.latestStatus || null,
      evaluator: result.agentResult.evaluatorOutput || null,
      reactTrace: result.agentResult.reactTrace || null,
      transcription: result.transcription,
      latency: result.latency,
      session: result.updatedSession,
    }
  })}\n\n`);
  res.end();
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

export const synthesizeInterviewText = asyncHandler(async (req, res) => {
  const { sessionId, text, voiceName } = req.body;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);

  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  ensureInterviewInProgress(session);

  const cleanText = String(text || '').trim();
  if (!cleanText) {
    return res.status(400).json(formatError('Text is required', 'VALIDATION_ERROR', 'Text to synthesize cannot be empty'));
  }

  const result = await synthesizeSpeech({
    text: cleanText,
    voiceName: String(voiceName || '').trim() || undefined,
    usageContext: {
      userId: user.id,
      sessionId,
      stage: 'interview',
      source: 'interview_synthesize_endpoint',
    },
  });
  
  logger.info('Synthesized text to speech', getRequestLogMeta(req, {
    textLength: cleanText.length,
    voiceName: result.voiceName,
  }));

  res.json(formatSuccess('Text synthesized', {
    assistantAudio: {
      base64: result.audioBuffer.toString('base64'),
      contentType: result.contentType,
    }
  }));
});
