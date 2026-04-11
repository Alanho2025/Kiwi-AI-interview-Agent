/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: sessionController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { formatSuccess } from '../utils/responseFormatter.js';
import { getSessionById, listSessionsByUserId, updateSession } from '../services/sessionService.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { badRequest, notFound } from '../utils/appError.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

export const saveSession = asyncHandler(async (req, res) => {
  const { sessionId, data } = req.body;
  if (!sessionId) {
    throw badRequest('Missing sessionId', 'sessionId is required');
  }

  const session = await updateSession(sessionId, data);
  if (!session) {
    throw notFound('Session not found', 'Invalid session ID');
  }

  logger.info('Session saved', getRequestLogMeta(req));
  res.json(formatSuccess('Session saved', { session }));
});

export const getSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const session = await getSessionById(sessionId);
  if (!session) {
    throw notFound('Session not found', 'Invalid session ID');
  }

  res.json(formatSuccess('Session retrieved', { session }));
});

export const getSessionHistory = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const sessions = await listSessionsByUserId(user.id, req.query.limit || 20);
  res.json(formatSuccess('Session history retrieved', { sessions }));
});

export const resumeSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    throw badRequest('Missing sessionId', 'sessionId is required');
  }

  const session = await getSessionById(sessionId);
  if (!session) {
    throw notFound('Session not found', 'Invalid session ID');
  }

  session.status = 'in_progress';
  const updatedSession = await updateSession(sessionId, session);
  logger.info('Session resumed', getRequestLogMeta(req));
  res.json(formatSuccess('Session resumed', { session: updatedSession }));
});
