import { formatSuccess } from '../utils/responseFormatter.js';
import { forbidden } from '../utils/appError.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { loadOwnedSessionOrThrow, requireSessionId } from '../services/interview/interviewSessionService.js';
import { getInterviewQuestionDiagnostics } from '../services/questions/interviewQuestionDiagnosticsService.js';

export const getQuestionDiagnostics = asyncHandler(async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    throw forbidden('Question diagnostics are disabled in production.');
  }

  const sessionId = req.params.sessionId || req.query.sessionId;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);
  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  const diagnostics = await getInterviewQuestionDiagnostics({ session });

  res.json(formatSuccess('Question diagnostics loaded', {
    sessionId,
    diagnostics,
  }));
});
