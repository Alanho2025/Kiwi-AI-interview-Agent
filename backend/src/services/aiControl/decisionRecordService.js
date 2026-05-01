import crypto from 'crypto';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { AGENT_TOOL_NAMES } from '../../constants/agentToolNames.js';

export const createDecisionRecord = async ({ sessionId, record = {} } = {}) => {
  if (!sessionId) {
    return null;
  }

  const payload = {
    decisionId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    tool: record.tool || AGENT_TOOL_NAMES.PLAN_INTERVIEW_ACTION,
    ...record,
  };

  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    { $push: { decisionRecords: payload } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return payload;
};

export const listDecisionRecords = async (sessionId) => {
  if (!sessionId) {
    return [];
  }

  const record = await SessionAnalysis.findOne({ sessionId }).lean();
  return Array.isArray(record?.decisionRecords) ? record.decisionRecords : [];
};
