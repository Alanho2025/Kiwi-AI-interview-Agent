/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: reportController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { formatSuccess } from '../utils/responseFormatter.js';
import { runTask } from '../services/masterAiService.js';
import { getOwnedSessionById } from '../services/sessionService.js';
import { SessionReport } from '../db/models/sessionReportModel.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { notFound, badRequest } from '../utils/appError.js';
import { requireBodyField } from '../utils/controllerHelpers.js';
import { saveTextToLocalStorage } from '../services/storageService.js';
import { createUploadedFileRecord } from '../services/fileRepositoryService.js';
import { createAuditLog } from '../services/auditService.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';
import {
  buildCandidateReportProjection,
  buildCandidateReportPublicationSummary,
  buildLegacyReportLimitation,
} from '../services/report/reportPublicationSummaryService.js';
import {
  saveCandidateReflection,
} from '../services/report/candidateReportReflectionService.js';

const attachCandidatePublicationSummary = (value = {}, latestStatus = value?.latestStatus) => ({
  ...value,
  publicationSummary: buildCandidateReportPublicationSummary({ latestStatus }),
});

const toCandidateReportRecord = (value = {}) => buildCandidateReportProjection(value);

const attachLegacyLimitation = ({ reportRecord = {}, session = {} } = {}) => {
  const limitation = buildLegacyReportLimitation({ transcript: session.transcript || [] });
  if (!limitation) return reportRecord;
  const raw = typeof reportRecord?.toObject === 'function' ? reportRecord.toObject() : reportRecord;
  return {
    ...raw,
    report: {
      ...(raw?.report || {}),
      legacyLimitations: [limitation],
    },
  };
};

export const generateReport = asyncHandler(async (req, res) => {
  const sessionId = requireBodyField(req, 'sessionId', 'sessionId is required');
  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to generate this report');
  }
  const result = await runTask({ taskType: 'generate_report', sessionId });
  const candidateProjection = toCandidateReportRecord({
    sessionId,
    ...(result.stored || {}),
    report: result.stored?.report || result.report,
  });
  const candidateResult = {
    ...candidateProjection,
    stored: result.stored ? candidateProjection : null,
  };
  res.json(formatSuccess(
    'Report generated',
    attachCandidatePublicationSummary(candidateResult, result.stored?.latestStatus),
  ));
});

export const qaReport = asyncHandler(async (req, res) => {
  const sessionId = requireBodyField(req, 'sessionId', 'sessionId is required');
  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to QA this report');
  }
  const result = await runTask({ taskType: 'qa_report', sessionId });
  const candidateProjection = toCandidateReportRecord({
    sessionId,
    ...(result.stored || {}),
    report: result.stored?.report || result.report,
  });
  const candidateResult = {
    ...candidateProjection,
    stored: result.stored ? candidateProjection : null,
  };
  res.json(formatSuccess(
    'Report QA completed',
    attachCandidatePublicationSummary(candidateResult, result.stored?.latestStatus),
  ));
});

export const getReport = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const user = await resolveUserFromRequest(req);
  
  // First verify session ownership
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to view this report');
  }
  
  const report = await SessionReport.findOne({ sessionId }).lean();
  if (!report) {
    throw notFound('Report not found', 'No report exists for this session');
  }
  const candidateReport = toCandidateReportRecord(attachLegacyLimitation({
    reportRecord: report,
    session,
  }));
  res.json(formatSuccess(
    'Report retrieved',
    attachCandidatePublicationSummary(candidateReport),
  ));
});

export const saveReportReflection = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to add a reflection');
  }
  const reflection = await saveCandidateReflection({
    sessionId,
    reflection: req.body?.reflection,
    focusArea: req.body?.focusArea,
  });
  res.json(formatSuccess('Reflection saved', { reflection }));
});

/**
 * Purpose: Execute the main responsibility for exportReport.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const exportReport = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { format = 'json' } = req.body;
  
  if (!['json', 'txt'].includes(format)) {
    throw badRequest('Invalid format', 'Format must be either "json" or "txt"');
  }
  
  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to export this report');
  }
  
  const report = await SessionReport.findOne({ sessionId }).lean();
  if (!report) {
    throw notFound('Report not found', 'No report exists for this session');
  }
  const candidateReport = toCandidateReportRecord(attachLegacyLimitation({
    reportRecord: report,
    session,
  }));
  
  let fileContent, fileExtension, mimeType;
  
  if (format === 'json') {
    fileContent = JSON.stringify(candidateReport, null, 2);
    fileExtension = 'json';
    mimeType = 'application/json';
  } else {
    // Format as text report
    fileContent = formatReportAsText(candidateReport);
    fileExtension = 'txt';
    mimeType = 'text/plain';
  }
  
  const storage = await saveTextToLocalStorage({
    text: fileContent,
    suggestedFilename: `report-${sessionId}.${fileExtension}`,
    folder: 'exports',
  });
  
  const exportFileId = await createUploadedFileRecord({
    userId: session.userId,
    sessionId,
    fileRole: 'report_export',
    originalFilename: `report-${sessionId}.${fileExtension}`,
    mimeType,
    storageProvider: storage.storageProvider,
    storageKey: storage.storageKey,
    fileSizeBytes: Buffer.byteLength(fileContent, 'utf8'),
    isEncrypted: storage.isEncrypted,
    virusScanStatus: storage.virusScanStatus,
    virusScannedAt: storage.virusScannedAt,
  });
  
  await createAuditLog({
    actorUserId: session.userId,
    targetUserId: session.userId,
    sessionId,
    actionType: 'export_report',
    resourceType: 'uploaded_file',
    resourceId: exportFileId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
  
  logger.info('Report exported', getRequestLogMeta(req, { exportFileId, format }));
  res.json(formatSuccess('Report exported', { exportFileId, format, storageKey: storage.storageKey }));
});

/**
 * Purpose: Format report as readable text.
 * Inputs: Report object from MongoDB.
 * Returns: Formatted text string.
 */
export function formatReportAsText(report) {
  const candidateReport = toCandidateReportRecord(report);
  const lines = [];
  const r = candidateReport.report || {};
  const formatScore = (value, suffix = '') => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? `${parsed.toFixed(2)}${suffix}` : 'Not available';
  };
  const formatListItem = (item) => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return String(item ?? '');
    return item.title || item.label || item.message || item.description || item.content || item.summary || JSON.stringify(item);
  };
  
  lines.push('KIWI AI INTERVIEW AGENT - INTERVIEW REPORT');
  lines.push('==========================================');
  lines.push(`Generated: ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : new Date().toLocaleString()}`);
  lines.push(`Report Status: ${candidateReport.latestStatus || 'unknown'}`);
  lines.push('');
  
  // Candidate & Role Information
  if (r.candidateName || r.jobTitle) {
    lines.push('CANDIDATE & ROLE');
    lines.push('================');
    if (r.candidateName) lines.push(`Candidate: ${r.candidateName}`);
    if (r.jobTitle) lines.push(`Target Role: ${r.jobTitle}`);
    lines.push('');
  }
  
  // Summary
  if (r.summary) {
    lines.push('EXECUTIVE SUMMARY');
    lines.push('=================');
    lines.push(r.summary);
    lines.push('');
  }

  if (r.legacyLimitations?.length) {
    lines.push('REPORT LIMITATION');
    lines.push('=================');
    r.legacyLimitations.forEach((item) => lines.push(`- ${formatListItem(item)}`));
    lines.push('');
  }

  if (r.transcriptRisks?.length) {
    lines.push('TRANSCRIPT RISKS');
    lines.push('================');
    r.transcriptRisks.forEach((item) => lines.push(`- ${formatListItem(item)}`));
    lines.push('');
  }
  
  // Scores
  if (r.scores?.overall !== undefined) {
    lines.push('SCORES');
    lines.push('======');
    if (r.scores.overall !== undefined) lines.push(`Interview Performance: ${formatScore(r.scores.overall, '/100')}`);
    lines.push('');
  }

  const scoreExplanations = Object.entries(r.scoreExplanations || {})
    .filter(([, item]) => item?.explanation)
    .slice(0, 3);
  if (scoreExplanations.length) {
    lines.push('SCORE EXPLANATIONS');
    lines.push('==================');
    scoreExplanations.forEach(([key, item]) => {
      lines.push(`- ${key}: ${item.explanation}`);
    });
    lines.push('');
  }

  const feedback = r.candidateFeedback || {};
  if (feedback.plainEnglishMetrics?.length) {
    lines.push('KEY INSIGHTS');
    lines.push('============');
    feedback.plainEnglishMetrics.slice(0, 3).forEach((item) => {
      const title = item?.title || item?.label || 'Insight';
      const detail = item?.description || item?.interpretation || item?.summary || '';
      lines.push(`- ${title}${detail ? `: ${detail}` : ''}`);
    });
    lines.push('');
  }

  if (feedback.improvementPriorities?.length) {
    lines.push('TOP IMPROVEMENTS');
    lines.push('================');
    feedback.improvementPriorities.slice(0, 3).forEach((item, index) => {
      lines.push(`${index + 1}. ${item.title || 'Improvement'}`);
      if (item.whyItMatters || item.detail) lines.push(item.whyItMatters || item.detail);
      if (item.action || item.example) lines.push(`Next step: ${item.action || item.example}`);
    });
    lines.push('');
  }

  if (feedback.turnBreakdowns?.length) {
    lines.push('ANSWER FEEDBACK');
    lines.push('===============');
    feedback.turnBreakdowns.forEach((turn, index) => {
      lines.push(`${index + 1}. ${turn.question || 'Interview question'}`);
      if (turn.answer || turn.answerSummary) lines.push(`Your answer: ${turn.answer || turn.answerSummary}`);
      if (turn.feedback) lines.push(`Feedback: ${turn.feedback}`);
    });
    lines.push('');
  }

  if (feedback.answerRewriteExamples?.length) {
    lines.push('HOW TO ANSWER BETTER');
    lines.push('====================');
    feedback.answerRewriteExamples.forEach((item, index) => {
      lines.push(`${index + 1}. Weaker: ${item.weak || 'Not available'}`);
      lines.push(`   Stronger: ${item.better || item.failureReason || 'Rewrite unavailable'}`);
    });
    lines.push('');
  }

  // Recommendations
  if (r.recommendations && r.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    lines.push('===============');
    r.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${formatListItem(rec)}`);
    });
    lines.push('');
  }
  
  lines.push('END OF REPORT');
  lines.push('=============');
  
  return lines.join('\n');
}
