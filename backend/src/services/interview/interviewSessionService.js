import {
  appendTranscriptTurn,
  createInterviewResponse,
  getLatestQuestionForSession,
  getOwnedSessionById,
  updateSession,
} from '../sessionService.js';
import { badRequest, invalidState, notFound } from '../../utils/appError.js';

const toSafeElapsedSeconds = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
};

const getActiveElapsedSeconds = (session) => {
  if (!session?.lastResumedAt || session?.status !== 'in_progress') return 0;
  const resumedAt = new Date(session.lastResumedAt).getTime();
  if (!Number.isFinite(resumedAt)) return 0;
  const elapsedMs = Date.now() - resumedAt;
  return elapsedMs > 0 ? Math.floor(elapsedMs / 1000) : 0;
};

export const requireSessionId = (sessionId) => {
  if (!sessionId) {
    throw badRequest('Missing sessionId', 'sessionId is required');
  }
};

export const normalizeInterviewAnswer = (answer) => {
  const normalizedAnswer = answer?.trim();
  if (!normalizedAnswer) {
    throw badRequest('Missing answer', 'Please provide an interview answer');
  }
  return normalizedAnswer;
};

export const loadOwnedSessionOrThrow = async ({ sessionId, userId }) => {
  const session = await getOwnedSessionById(sessionId, userId);
  if (!session) {
    throw notFound('Session not found or unavailable', 'Invalid session ID or you cannot access this session');
  }
  return session;
};

export const ensureInterviewInProgress = (session) => {
  if (session.status !== 'in_progress') {
    throw invalidState('Interview is not active', 'Resume the interview before replying');
  }
};

export const applyElapsedSeconds = (session) => {
  const baseElapsedSeconds = toSafeElapsedSeconds(session?.elapsedSeconds);
  const activeElapsedSeconds = getActiveElapsedSeconds(session);

  return {
    ...session,
    elapsedSeconds: baseElapsedSeconds + activeElapsedSeconds,
    lastResumedAt: null,
  };
};

export const saveInterviewAnswerWithDetails = async ({
  sessionId,
  questionId,
  transcriptText,
  responseMode = 'text',
  audioDurationSeconds = null,
  audioStorageKey = null,
  asrProvider = null,
  asrLanguage = null,
  asrConfidence = null,
  providerPayload = null,
}) => {
  if (questionId) {
    await createInterviewResponse({
      sessionId,
      questionId,
      transcriptText,
      responseMode,
      audioDurationSeconds,
      audioStorageKey,
      asrProvider,
      asrLanguage,
      asrConfidence,
      providerPayload,
    });
  }
};

export const saveInterviewAnswer = async (sessionId, answerText) => {
  const timestamp = new Date().toISOString();
  const latestQuestion = await getLatestQuestionForSession(sessionId);

  await appendTranscriptTurn(sessionId, {
    role: 'user',
    text: answerText,
    timestamp,
    metadata: { inputMode: 'text' },
  });

  await saveInterviewAnswerWithDetails({
    sessionId,
    questionId: latestQuestion?.id,
    transcriptText: answerText,
    responseMode: 'text',
  });
};

export const pauseInterviewSession = async (session) => {
  const pausedSession = applyElapsedSeconds(session);
  return updateSession(session.id, session.userId, {
    elapsedSeconds: pausedSession.elapsedSeconds,
    lastResumedAt: null,
    status: 'paused',
  });
};

export const resumeInterviewSession = async (session) => {
  return updateSession(session.id, session.userId, {
    status: 'in_progress',
    lastResumedAt: new Date().toISOString(),
  });
};

export const completeInterviewSession = async (session, options = {}) => {
  const completedSession = applyElapsedSeconds(session);
  return updateSession(session.id, session.userId, {
    elapsedSeconds: completedSession.elapsedSeconds,
    lastResumedAt: null,
    status: 'completed',
    endedAt: new Date().toISOString(),
    completedBecause: options.completedBecause || session.completedBecause || 'manual_end',
  });
};
