import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';

const ensureArray = (value) => (Array.isArray(value) ? value : []);
const normalizeText = (value = '') => String(value || '').trim().toLowerCase();

const dedupeMemories = (records = []) => {
  const seen = new Set();
  const result = [];
  for (const item of records) {
    const key = `${normalizeText(item.pattern)}|${normalizeText(item.lesson)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
};

export const getBoundedExperienceMemory = async (sessionId, limit = 3) => {
  if (!sessionId) return [];
  const record = await SessionAnalysis.findOne({ sessionId }).lean();
  return ensureArray(record?.reflectionRecords).slice(-limit);
};

export const buildMemorySummary = (records = []) => {
  const items = ensureArray(records).slice(-3);
  if (!items.length) return 'No coaching memory yet.';
  return items.map((item) => item.lesson).join(' ');
};

export const rebuildBoundedMemory = async ({ sessionId, maxRecords = 6 } = {}) => {
  if (!sessionId) return [];
  const record = await SessionAnalysis.findOne({ sessionId }).lean();
  const nextRecords = dedupeMemories(ensureArray(record?.reflectionRecords)).slice(-maxRecords);
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $set: {
        reflectionRecords: nextRecords,
        latestReflectionRecord: nextRecords.at(-1) || null,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return nextRecords;
};
