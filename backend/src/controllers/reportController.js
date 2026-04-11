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
import { SessionReport } from '../db/models/sessionReportModel.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { notFound } from '../utils/appError.js';
import { requireBodyField } from '../utils/controllerHelpers.js';

export const generateReport = asyncHandler(async (req, res) => {
  const sessionId = requireBodyField(req, 'sessionId', 'sessionId is required');
  const result = await runTask({ taskType: 'generate_report', sessionId });
  res.json(formatSuccess('Report generated', result));
});

export const qaReport = asyncHandler(async (req, res) => {
  const sessionId = requireBodyField(req, 'sessionId', 'sessionId is required');
  const result = await runTask({ taskType: 'qa_report', sessionId });
  res.json(formatSuccess('Report QA completed', result));
});

export const getReport = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const report = await SessionReport.findOne({ sessionId }).lean();
  if (!report) {
    throw notFound('Report not found', 'No report exists for this session');
  }
  res.json(formatSuccess('Report retrieved', report));
});
