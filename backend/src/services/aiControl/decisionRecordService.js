import crypto from 'crypto';
import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';

export const createDecisionRecord = async ({ sessionId, record = {} } = {}) => {
  if (!sessionId) {
    return null;
  }

  const payload = {
    decisionId: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
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
