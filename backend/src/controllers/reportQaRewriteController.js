import { asyncHandler } from '../middleware/asyncHandler.js';
import { formatSuccess } from '../utils/responseFormatter.js';
import { requireBodyField } from '../utils/controllerHelpers.js';
import { notFound } from '../utils/appError.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { getOwnedSessionById } from '../services/sessionService.js';
import { runTask } from '../services/masterAiService.js';
import { agentRegistry } from '../services/agentRegistryService.js';
import { SessionReport } from '../db/models/sessionReportModel.js';
import { SessionAnalysis } from '../db/models/sessionAnalysisModel.js';
import { rewriteReportWithQaPrompt } from '../services/report/reportRewriteService.js';
import {
  buildCandidateReportProjection,
  buildCandidateReportPublicationSummary,
} from '../services/report/reportPublicationSummaryService.js';
import { buildRetentionExpiry } from '../services/retention/retentionPolicy.js';

const normalizeUserPrompt = (value = '') => String(value || '').trim().slice(0, 2000);

const toCandidateReportRecord = (value = {}) => buildCandidateReportProjection(value);

export const buildCandidateQaRewriteResponse = ({
  sessionId,
  report = {},
  stored = null,
  rewriteApplied = false,
} = {}) => {
  const candidateProjection = toCandidateReportRecord({
    sessionId,
    ...(stored || {}),
    report: stored?.report || report,
  });
  const candidateResponse = {
    ...candidateProjection,
    rewriteApplied: rewriteApplied === true,
    stored: stored ? candidateProjection : null,
  };
  return {
    ...candidateResponse,
    publicationSummary: buildCandidateReportPublicationSummary({ latestStatus: stored?.latestStatus }),
  };
};

const persistPromptRewrittenReport = async ({ sessionId, userId, report, qaResult, originalQaResult, rewriteMetadata }) => {
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $push: {
        reportArtifacts: {
          createdAt: new Date(),
          report,
          qaResult,
          originalQaResult,
          rewriteMetadata,
        },
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return SessionReport.findOneAndUpdate(
    { sessionId },
    {
      sessionId,
      userId,
      report,
      qaResult,
      latestStatus: qaResult?.passed ? 'ready' : 'needs_review',
      rewriteMetadata,
      retentionUntil: buildRetentionExpiry(),
      deletedAt: null,
      containsSensitiveData: true,
      accessScope: 'private',
      schemaVersion: 'v7',
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

export const qaRewriteReport = asyncHandler(async (req, res) => {
  const sessionId = requireBodyField(req, 'sessionId', 'sessionId is required');
  const userPrompt = normalizeUserPrompt(req.body?.userPrompt);
  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);

  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to QA this report');
  }

  if (!userPrompt) {
    const result = await runTask({ taskType: 'qa_report', sessionId });
    res.json(formatSuccess('Report QA completed', buildCandidateQaRewriteResponse({
      sessionId,
      report: result.report,
      stored: result.stored,
    })));
    return;
  }

  const existingQa = await runTask({ taskType: 'qa_report', sessionId });
  const storedReport = existingQa?.report || (await SessionReport.findOne({ sessionId }).lean())?.report;
  if (!storedReport) {
    throw notFound('Report not found', 'No report exists for this session');
  }

  const retrievalBundle = await agentRegistry.retrieval({
    query: `${session.targetRole || ''} report qa rewrite evidence`,
    sessionId: session.id,
    sourceTypes: ['cv_profile', 'jd_rubric', 'interview_plan', 'prepared_question_pool', 'transcript'],
    topK: 8,
    objective: 'qa_prompt_rewrite_report',
    targetTopic: 'report',
  });

  const rewriteResult = await rewriteReportWithQaPrompt({
    report: storedReport,
    qaResult: existingQa.qaResult,
    session,
    retrievalBundle,
    userPrompt,
  });

  const rewrittenQaResult = await agentRegistry.reportQa({
    report: rewriteResult.report,
    analysisResult: session.analysisResult || {},
    retrievalBundle,
  });

  const stored = await persistPromptRewrittenReport({
    sessionId,
    userId: session.userId,
    report: rewriteResult.report,
    qaResult: rewrittenQaResult,
    originalQaResult: existingQa.qaResult,
    rewriteMetadata: rewriteResult.rewriteMetadata,
  });

  res.json(formatSuccess('Report QA rewrite completed', buildCandidateQaRewriteResponse({
    sessionId,
    report: rewriteResult.report,
    rewriteApplied: rewriteResult.rewriteMetadata?.rewriteApplied === true,
    stored,
  })));
});
