import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { getSessionById, updateSession } from '../services/sessionService.js';

export const saveSession = async (req, res, next) => {
  console.log('ENTERING saveSession, sessionId:', req.body?.sessionId);
  try {
    const { sessionId, data } = req.body;
    console.log('Calling updateSession for saveSession');
    const session = await updateSession(sessionId, data);
    if (!session) {
      return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));
    }
    console.log('EXITING saveSession successfully');
    res.json(formatSuccess('Session saved', { session }));
  } catch (error) {
    console.error('ERROR in saveSession:', error.message, error.stack);
    next(error);
  }
};

export const getSession = async (req, res, next) => {
  console.log('ENTERING getSession, sessionId:', req.params.sessionId);
  try {
    const { sessionId } = req.params;
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));
    console.log('EXITING getSession successfully');
    res.json(formatSuccess('Session retrieved', { session }));
  } catch (error) {
    console.error('ERROR in getSession:', error.message, error.stack);
    next(error);
  }
};

export const resumeSession = async (req, res, next) => {
  console.log('ENTERING resumeSession, sessionId:', req.body?.sessionId);
  try {
    const { sessionId } = req.body;
    console.log('Calling getSessionById for resumeSession');
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    session.status = 'in_progress';
    await updateSession(sessionId, session);
    console.log('EXITING resumeSession successfully');
    res.json(formatSuccess('Session resumed', { session }));
  } catch (error) {
    console.error('ERROR in resumeSession:', error.message, error.stack);
    next(error);
  }
};
