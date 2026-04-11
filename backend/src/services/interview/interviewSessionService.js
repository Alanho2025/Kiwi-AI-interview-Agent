/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewSessionService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import {
  appendTranscriptTurn,
  createInterviewResponse,
  getLatestQuestionForSession,
  getSessionById,
  updateSession,
} from '../sessionService.js';
import { badRequest, invalidState, notFound } from '../../utils/appError.js';

/**
 * Purpose: Execute the main responsibility for requireSessionId.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const requireSessionId = (sessionId) => {
  if (!sessionId) {
    throw badRequest('Missing sessionId', 'sessionId is required');
  }
};

/**
 * Purpose: Execute the main responsibility for normalizeInterviewAnswer.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const normalizeInterviewAnswer = (answer) => {
  const normalizedAnswer = answer?.trim();
  if (!normalizedAnswer) {
    throw badRequest('Missing answer', 'Please provide an interview answer');
  }
  return normalizedAnswer;
};

/**
 * Purpose: Execute the main responsibility for loadSessionOrThrow.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const loadSessionOrThrow = async (sessionId) => {
  const session = await getSessionById(sessionId);
  if (!session) {
    throw notFound('Session not found', 'Invalid session ID');
  }
  return session;
};

/**
 * Purpose: Execute the main responsibility for ensureInterviewInProgress.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const ensureInterviewInProgress = (session) => {
  if (session.status !== 'in_progress') {
    throw invalidState('Interview is not active', 'Resume the interview before replying');
  }
};

/**
 * Purpose: Execute the main responsibility for applyElapsedSeconds.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const applyElapsedSeconds = (session) => {
  if (!session.lastResumedAt) {
    return session;
  }

  const elapsedMs = Date.now() - new Date(session.lastResumedAt).getTime();
  const elapsedSeconds = elapsedMs > 0 ? Math.floor(elapsedMs / 1000) : 0;

  return {
    ...session,
    elapsedSeconds: session.elapsedSeconds + elapsedSeconds,
    lastResumedAt: null,
  };
};

/**
 * Purpose: Execute the main responsibility for saveInterviewAnswer.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const saveInterviewAnswer = async (sessionId, answerText) => {
  const timestamp = new Date().toISOString();
  const latestQuestion = await getLatestQuestionForSession(sessionId);

  await appendTranscriptTurn(sessionId, {
    role: 'user',
    text: answerText,
    timestamp,
  });

  if (latestQuestion?.id) {
    await createInterviewResponse({
      sessionId,
      questionId: latestQuestion.id,
      transcriptText: answerText,
    });
  }
};

/**
 * Purpose: Execute the main responsibility for pauseInterviewSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const pauseInterviewSession = async (session) => {
  const pausedSession = applyElapsedSeconds(session);
  return updateSession(session.id, {
    ...pausedSession,
    status: 'paused',
  });
};

/**
 * Purpose: Execute the main responsibility for resumeInterviewSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const resumeInterviewSession = async (session) => {
  return updateSession(session.id, {
    ...session,
    status: 'in_progress',
    lastResumedAt: new Date().toISOString(),
  });
};

/**
 * Purpose: Execute the main responsibility for completeInterviewSession.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const completeInterviewSession = async (session) => {
  const completedSession = applyElapsedSeconds(session);
  return updateSession(session.id, {
    ...completedSession,
    status: 'completed',
  });
};
