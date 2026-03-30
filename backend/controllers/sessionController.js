import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { getSessionById, updateSession } from '../services/sessionService.js';

export const saveSession = async (req, res, next) => {
  try {
    const { sessionId, data } = req.body;
    const session = updateSession(sessionId, data);
    if (!session) {
      return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));
    }
    res.json(formatSuccess('Session saved', { session }));
  } catch (error) {
    next(error);
  }
};

export const getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));
    res.json(formatSuccess('Session retrieved', { session }));
  } catch (error) {
    next(error);
  }
};

export const resumeSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));
    
    session.status = 'in_progress';
    updateSession(sessionId, session);
    res.json(formatSuccess('Session resumed', { session }));
  } catch (error) {
    next(error);
  }
};
