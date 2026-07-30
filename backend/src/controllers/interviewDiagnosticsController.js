import { formatSuccess } from '../utils/responseFormatter.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { loadOwnedSessionOrThrow, requireSessionId } from '../services/interview/interviewSessionService.js';
import { getInterviewQuestionDiagnostics } from '../services/questions/interviewQuestionDiagnosticsService.js';
import { queryOwnedHarnessRunTimelines } from '../services/harness/harnessRunQueryService.js';
import { getRequestLogMeta, logger } from '../utils/logger.js';
import { assertDeveloperDiagnosticsAvailable } from '../services/diagnostics/developerDiagnosticsPolicyService.js';

export const getQuestionDiagnostics = asyncHandler(async (req, res) => {
  assertDeveloperDiagnosticsAvailable();

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

export const getHarnessRunDiagnostics = asyncHandler(async (req, res) => {
  assertDeveloperDiagnosticsAvailable();
  const user = await resolveUserFromRequest(req);
  const runs = await queryOwnedHarnessRunTimelines({
    ownerUserId: user.id,
    workflowRunId: req.query.workflowRunId || null,
    sessionId: req.query.sessionId || null,
    startedAfter: req.query.startedAfter || null,
    startedBefore: req.query.startedBefore || null,
    limit: req.query.limit || 25,
  });

  logger.info('Harness run diagnostics accessed', getRequestLogMeta(req, {
    ownerUserId: user.id,
    workflowRunId: req.query.workflowRunId || null,
    sessionId: req.query.sessionId || null,
    resultCount: runs.length,
  }));

  res.json(formatSuccess('Harness run diagnostics loaded', { runs }));
});
