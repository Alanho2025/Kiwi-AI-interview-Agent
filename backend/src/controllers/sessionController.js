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
import { getSessionById, getOwnedSessionById, listSessionsByUserId, updateSession, softDeleteOwnedSession } from '../services/sessionService.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { badRequest, notFound, forbidden } from '../utils/appError.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

export const saveSession = asyncHandler(async (req, res) => {
  const { sessionId, data } = req.body;
  if (!sessionId) {
    throw badRequest('Missing sessionId', 'sessionId is required');
  }

  const user = await resolveUserFromRequest(req);
  
  // First verify session ownership before updating
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to update this session');
  }

  const updatedSession = await updateSession(sessionId, data);
  if (!updatedSession) {
    throw notFound('Session not found', 'Invalid session ID');
  }

  logger.info('Session saved', getRequestLogMeta(req, { sessionId, userId: user.id }));
  res.json(formatSuccess('Session saved', { session: updatedSession }));
});

export const getSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to view this session');
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

  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to resume this session');
  }

  session.status = 'in_progress';
  const updatedSession = await updateSession(sessionId, session);
  logger.info('Session resumed', getRequestLogMeta(req, { sessionId, userId: user.id }));
  res.json(formatSuccess('Session resumed', { session: updatedSession }));
});

export const deleteSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  if (!sessionId) {
    throw badRequest('Missing sessionId', 'sessionId is required');
  }

  const user = await resolveUserFromRequest(req);
  const result = await softDeleteOwnedSession({ sessionId, userId: user.id });
  
  logger.info('Session deleted', getRequestLogMeta(req, { sessionId, userId: user.id }));
  res.json(formatSuccess('Session deleted successfully', result));
});
