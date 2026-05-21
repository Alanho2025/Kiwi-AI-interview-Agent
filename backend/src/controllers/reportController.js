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
import { getSessionExecutionCost } from '../services/aiUsageTrackingService.js';

export const generateReport = asyncHandler(async (req, res) => {
  const sessionId = requireBodyField(req, 'sessionId', 'sessionId is required');
  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to generate this report');
  }
  const result = await runTask({ taskType: 'generate_report', sessionId });
  const executionCost = await getSessionExecutionCost({ userId: user.id, sessionId });
  result.executionCost = executionCost;
  result.commercialStressTest = executionCost?.commercialStressTest || null;
  res.json(formatSuccess('Report generated', result));
});

export const qaReport = asyncHandler(async (req, res) => {
  const sessionId = requireBodyField(req, 'sessionId', 'sessionId is required');
  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to QA this report');
  }
  const result = await runTask({ taskType: 'qa_report', sessionId });
  const executionCost = await getSessionExecutionCost({ userId: user.id, sessionId });
  result.executionCost = executionCost;
  result.commercialStressTest = executionCost?.commercialStressTest || null;
  res.json(formatSuccess('Report QA completed', result));
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
  const executionCost = await getSessionExecutionCost({ userId: user.id, sessionId });
  const reportWithCost = {
    ...report,
    executionCost,
    commercialStressTest: executionCost?.commercialStressTest || null,
  };
  res.json(formatSuccess('Report retrieved', reportWithCost));
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
  const executionCost = await getSessionExecutionCost({ userId: user.id, sessionId });
  const reportWithCost = {
    ...report,
    executionCost,
    commercialStressTest: executionCost?.commercialStressTest || null,
  };
  
  let fileContent, fileExtension, mimeType;
  
  if (format === 'json') {
    fileContent = JSON.stringify(reportWithCost, null, 2);
    fileExtension = 'json';
    mimeType = 'application/json';
  } else {
    // Format as text report
    fileContent = formatReportAsText(reportWithCost);
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
function formatReportAsText(report) {
  const lines = [];
  const r = report.report || {};
  const qa = report.qaResult || {};
  const commercialStressTest = report.commercialStressTest || r.commercialStressTest || null;
  
  lines.push('KIWI AI INTERVIEW AGENT - INTERVIEW REPORT');
  lines.push('==========================================');
  lines.push(`Generated: ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : new Date().toLocaleString()}`);
  lines.push(`Session ID: ${report.sessionId}`);
  lines.push(`Report Status: ${report.latestStatus || 'unknown'}`);
  lines.push(`Schema Version: ${r.schemaVersion || 'unknown'}`);
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
  
  // Scores
  if (r.scores) {
    lines.push('SCORES');
    lines.push('======');
    if (r.scores.overall !== undefined) lines.push(`Overall Score: ${r.scores.overall.toFixed(2)}/100`);
    if (r.scores.macro !== undefined) lines.push(`Macro Score: ${r.scores.macro.toFixed(2)}/100`);
    if (r.scores.micro !== undefined) lines.push(`Micro Score: ${r.scores.micro.toFixed(2)}/100`);
    if (r.scores.requirements !== undefined) lines.push(`Requirements Score: ${r.scores.requirements.toFixed(2)}/100`);
    if (r.scores.evidenceStrength !== undefined) lines.push(`Evidence Strength: ${r.scores.evidenceStrength}/4`);
    if (r.scores.directEvidenceTurns !== undefined) lines.push(`Direct Evidence Turns: ${r.scores.directEvidenceTurns}`);
    if (r.scores.hypotheticalTurns !== undefined) lines.push(`Hypothetical Turns: ${r.scores.hypotheticalTurns}`);
    lines.push('');
  }

  if (commercialStressTest) {
    lines.push('COMMERCIAL STRESS TEST');
    lines.push('======================');
    lines.push(`Total Execution Cost: $${commercialStressTest.totalExecutionCost ?? 0}`);
    lines.push(`LLM Tokens: ${commercialStressTest.totalLlmTokens ?? 0}`);
    lines.push(`Speech Usage Seconds: ${commercialStressTest.speechAudioSeconds ?? 0}`);
    const minutes = commercialStressTest.estimatedHumanMinutesReplaced || {};
    lines.push(`Estimated Human Time Replaced: ${minutes.min ?? 0}-${minutes.max ?? 0} minutes`);
    if (commercialStressTest.conclusion) lines.push(commercialStressTest.conclusion);
    if (commercialStressTest.assumptions) lines.push(`Assumptions: ${commercialStressTest.assumptions}`);
    lines.push('');
  }
  
  // Sections (detailed content)
  if (r.sections && r.sections.length > 0) {
    lines.push('DETAILED ANALYSIS');
    lines.push('=================');
    lines.push('');
    r.sections.forEach((section, i) => {
      lines.push(`${i + 1}. ${section.title || 'Section'}`);
      lines.push('-'.repeat(section.title ? section.title.length + 3 : 10));
      if (section.content) {
        lines.push(section.content);
      }
      lines.push('');
    });
  }
  
  // Recommendations
  if (r.recommendations && r.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    lines.push('===============');
    r.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }
  
  // Interview Metrics
  if (r.interviewMetrics) {
    lines.push('INTERVIEW METRICS');
    lines.push('=================');
    const m = r.interviewMetrics;
    if (m.candidateTurnCount !== undefined) lines.push(`Candidate Turns: ${m.candidateTurnCount}`);
    if (m.interviewerQuestionCount !== undefined) lines.push(`Interviewer Questions: ${m.interviewerQuestionCount}`);
    if (m.plannedQuestionCount !== undefined) lines.push(`Planned Questions: ${m.plannedQuestionCount}`);
    if (m.extraAiTurnCount !== undefined) lines.push(`Extra AI Turns: ${m.extraAiTurnCount}`);
    if (m.interviewCompletedByLimit !== undefined) lines.push(`Completed by Limit: ${m.interviewCompletedByLimit ? 'Yes' : 'No'}`);
    lines.push('');
  }
  
  // Evidence Diagnostics
  if (r.evidenceDiagnostics) {
    lines.push('EVIDENCE DIAGNOSTICS');
    lines.push('====================');
    const ed = r.evidenceDiagnostics;
    if (ed.averageStrength !== undefined) lines.push(`Average Strength: ${ed.averageStrength}/4`);
    if (ed.totals) {
      lines.push('Evidence Type Breakdown:');
      if (ed.totals.direct_past_experience !== undefined) lines.push(`  - Direct Past Experience: ${ed.totals.direct_past_experience}`);
      if (ed.totals.adjacent_experience !== undefined) lines.push(`  - Adjacent Experience: ${ed.totals.adjacent_experience}`);
      if (ed.totals.hypothetical_understanding !== undefined) lines.push(`  - Hypothetical Understanding: ${ed.totals.hypothetical_understanding}`);
      if (ed.totals.generic_filler !== undefined) lines.push(`  - Generic Filler: ${ed.totals.generic_filler}`);
    }
    lines.push('');
  }
  
  // QA Results
  if (qa && Object.keys(qa).length > 0) {
    lines.push('QUALITY ASSURANCE');
    lines.push('=================');
    if (qa.coverage !== undefined) lines.push(`Coverage: ${qa.coverage}%`);
    if (qa.quality !== undefined) lines.push(`Quality: ${qa.quality}%`);
    if (qa.completeness !== undefined) lines.push(`Completeness: ${qa.completeness}%`);
    if (qa.notes && qa.notes.length > 0) {
      lines.push('QA Notes:');
      qa.notes.forEach((note, i) => {
        lines.push(`  ${i + 1}. ${note}`);
      });
    }
    if (qa.flags && qa.flags.length > 0) {
      lines.push('QA Flags:');
      qa.flags.forEach((flag, i) => {
        lines.push(`  ${i + 1}. ${flag}`);
      });
    }
    lines.push('');
  }
  
  lines.push('END OF REPORT');
  lines.push('=============');
  
  return lines.join('\n');
}
