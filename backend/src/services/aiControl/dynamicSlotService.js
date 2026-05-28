import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { normalizeText, tokenize, unique } from '../../utils/commonHelpers.js';

const DEFAULT_DYNAMIC_SLOT_STATE = {
  activeSlots: [],
  activeSlotTopics: [],
  prunedSlots: [],
  lastUpdatedAt: null,
};

const classifyTopic = (answerText = '') => {
  const tokens = tokenize(answerText);
  if (tokens.some((item) => ['deploy', 'production', 'ship', 'release'].includes(item))) return 'deployment';
  if (tokens.some((item) => ['tradeoff', 'decision', 'chose', 'choose'].includes(item))) return 'decision_tradeoff';
  if (tokens.some((item) => ['team', 'collaboration', 'stakeholder'].includes(item))) return 'collaboration';
  if (tokens.some((item) => ['security', 'jwt', 'auth', 'rate', 'permission'].includes(item))) return 'api_security';
  if (tokens.some((item) => ['design', 'architecture', 'scalability'].includes(item))) return 'system_design';
  return null;
};

export const deriveDynamicSlots = ({ latestAnswer = '', coverageState = {}, existingState = {} } = {}) => {
  const topic = classifyTopic(latestAnswer);
  const activeSlots = Array.isArray(existingState.activeSlots) ? [...existingState.activeSlots] : [];
  const prunedSlots = Array.isArray(existingState.prunedSlots) ? [...existingState.prunedSlots] : [];
  if (topic && !activeSlots.find((item) => item.topic === topic) && !(coverageState.coveredTopics || []).includes(topic)) {
    activeSlots.push({
      slotKey: `dynamic_${topic}`,
      topic,
      reason: `Derived from latest answer mentioning signals related to ${topic}.`,
      priority: 0.6,
    });
  }
  const cappedSlots = activeSlots.slice(-5);
  if (activeSlots.length > cappedSlots.length) {
    prunedSlots.push(...activeSlots.slice(0, activeSlots.length - cappedSlots.length));
  }
  return {
    activeSlots: cappedSlots,
    activeSlotTopics: unique(cappedSlots.map((item) => item.topic)),
    prunedSlots,
    lastUpdatedAt: new Date().toISOString(),
  };
};

export const getDynamicSlotState = async (sessionId) => {
  if (!sessionId) return { ...DEFAULT_DYNAMIC_SLOT_STATE };
  const record = await SessionAnalysis.findOne({ sessionId }).lean();
  return {
    ...DEFAULT_DYNAMIC_SLOT_STATE,
    ...(record?.latestDynamicSlots || {}),
  };
};

export const persistDynamicSlotState = async ({ sessionId, dynamicSlots = {} } = {}) => {
  if (!sessionId) return null;
  await SessionAnalysis.findOneAndUpdate(
    { sessionId },
    {
      $push: { dynamicSlotRecords: dynamicSlots },
      $set: { latestDynamicSlots: dynamicSlots },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return dynamicSlots;
};
