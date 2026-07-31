import { UserCoachingMemory } from '../../db/models/userCoachingMemoryModel.js';
import { ensureArray, normalizeText } from '../../utils/commonHelpers.js';

const toCoachingRecord = (reflection = {}) => ({
  memoryId: reflection.reflectionId,
  sourceWorkflowRunId: reflection.sourceWorkflowRunId || null,
  pattern: reflection.pattern,
  lesson: reflection.lesson,
  recommendedNextStrategy: reflection.recommendedNextStrategy,
  applicableSections: reflection.applicableSections || [],
  confidence: reflection.confidence || 0,
  topic: reflection.topic,
  updatedAt: reflection.createdAt || new Date().toISOString(),
});

export const dedupeUserCoachingMemoryRecords = (records = []) => {
  const seen = new Set();
  return ensureArray(records).reduceRight((deduped, item) => {
    const key = `${normalizeText(item.pattern)}|${normalizeText(item.lesson)}`;
    if (seen.has(key)) return deduped;
    seen.add(key);
    deduped.unshift(item);
    return deduped;
  }, []);
};

const buildSummary = (records = []) => {
  const top = ensureArray(records).slice(-3);
  if (!top.length) return 'No long-term coaching memory yet.';
  return top.map((item) => item.lesson).join(' ');
};

export const getUserCoachingMemory = async (userId) => {
  if (!userId) return { memoryRecords: [], latestSummary: '' };
  const record = await UserCoachingMemory.findOne({ userId }).lean();
  return {
    memoryRecords: ensureArray(record?.memoryRecords).slice(-5),
    latestSummary: record?.latestSummary || '',
  };
};

export const persistUserCoachingMemory = async ({ userId, reflectionRecord = {}, maxRecords = 8 } = {}) => {
  if (!userId || !reflectionRecord?.reflectionId) return null;
  const existing = await getUserCoachingMemory(userId);
  const nextRecords = dedupeUserCoachingMemoryRecords([
    ...existing.memoryRecords,
    toCoachingRecord(reflectionRecord),
  ]).slice(-maxRecords);
  const latestSummary = buildSummary(nextRecords);
  await UserCoachingMemory.findOneAndUpdate(
    { userId },
    {
      $set: {
        memoryRecords: nextRecords,
        latestSummary,
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return { memoryRecords: nextRecords, latestSummary };
};
