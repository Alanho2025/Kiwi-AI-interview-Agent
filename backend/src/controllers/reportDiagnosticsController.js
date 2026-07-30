import { SessionReport } from '../db/models/sessionReportModel.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { assertDeveloperDiagnosticsAvailable } from '../services/diagnostics/developerDiagnosticsPolicyService.js';
import { getSessionExecutionCost } from '../services/aiUsageTrackingService.js';
import { loadOwnedSessionOrThrow, requireSessionId } from '../services/interview/interviewSessionService.js';
import { queryOwnedHarnessRunTimelines } from '../services/harness/harnessRunQueryService.js';
import { getInterviewQuestionDiagnostics } from '../services/questions/interviewQuestionDiagnosticsService.js';
import { redactSensitiveReportValues } from '../services/report/reportPublicationSummaryService.js';
import { formatSuccess } from '../utils/responseFormatter.js';
import { getRequestLogMeta, logger } from '../utils/logger.js';

const buildTurnEligibilityDiagnostics = (transcript = []) => transcript.map((turn, index) => ({
  index,
  role: turn?.role || null,
  turnType: turn?.metadata?.turnType || null,
  countsAsQuestion: turn?.metadata?.countsAsQuestion !== false,
  countsAsAnswer: turn?.metadata?.countsAsAnswer !== false,
  clarificationIntent: turn?.metadata?.clarificationIntent || null,
  scopeResponseReason: turn?.metadata?.scopeResponseReason || null,
  rootQuestionId: turn?.metadata?.rootQuestionId || turn?.questionId || null,
}));

export const getReportDiagnostics = asyncHandler(async (req, res) => {
  assertDeveloperDiagnosticsAvailable();
  const sessionId = req.params.sessionId;
  requireSessionId(sessionId);
  const user = await resolveUserFromRequest(req);
  const session = await loadOwnedSessionOrThrow({ sessionId, userId: user.id });
  const [storedReport, executionCost, questionDiagnostics, harnessRuns] = await Promise.all([
    SessionReport.findOne({ sessionId }).lean(),
    getSessionExecutionCost({ userId: user.id, sessionId }),
    getInterviewQuestionDiagnostics({ session }),
    queryOwnedHarnessRunTimelines({
      ownerUserId: user.id,
      sessionId,
      limit: 10,
    }),
  ]);
  const diagnostics = redactSensitiveReportValues({
    sessionId,
    report: storedReport?.report || null,
    qaResult: storedReport?.qaResult || null,
    latestStatus: storedReport?.latestStatus || null,
    executionCost,
    questionDiagnostics,
    harnessRuns,
    turnEligibility: buildTurnEligibilityDiagnostics(session.transcript || []),
  });

  logger.info('Report diagnostics accessed', getRequestLogMeta(req, {
    ownerUserId: user.id,
    sessionId,
    hasReport: Boolean(storedReport),
  }));
  res.json(formatSuccess('Report diagnostics loaded', diagnostics));
});
