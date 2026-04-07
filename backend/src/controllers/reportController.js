import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { runTask } from '../services/masterAiService.js';
import { SessionReport } from '../db/models/sessionReportModel.js';

export const generateReport = async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json(formatError('Missing sessionId', 'MISSING_PARAM', 'sessionId is required'));
    }

    const result = await runTask({ taskType: 'generate_report', sessionId });
    res.json(formatSuccess('Report generated', result));
  } catch (error) {
    next(error);
  }
};

export const qaReport = async (req, res, next) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId) {
      return res.status(400).json(formatError('Missing sessionId', 'MISSING_PARAM', 'sessionId is required'));
    }

    const result = await runTask({ taskType: 'qa_report', sessionId });
    res.json(formatSuccess('Report QA completed', result));
  } catch (error) {
    next(error);
  }
};

export const getReport = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const report = await SessionReport.findOne({ sessionId }).lean();
    if (!report) {
      return res.status(404).json(formatError('Report not found', 'NOT_FOUND', 'No report exists for this session'));
    }
    res.json(formatSuccess('Report retrieved', report));
  } catch (error) {
    next(error);
  }
};
