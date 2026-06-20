import crypto from 'crypto';
import { AiUsageEvent } from '../db/models/aiUsageEventModel.js';
import { TokenUsage } from '../db/models/tokenUsageModel.js';
import { UsageDailyRollup } from '../db/models/usageDailyRollupModel.js';

export const AI_USAGE_ROLLUP_SOURCE = 'ai_usage_event';
export const TOKEN_USAGE_ROLLUP_SOURCE = 'token_usage';

const SUMMARY_FIELDS = [
  'totalCostUsd',
  'totalPromptTokens',
  'totalCompletionTokens',
  'totalTokens',
  'speechAudioSeconds',
  'speechTextCharacters',
  'speechAudioBytes',
  'callCount',
];

const emptyRollupSummary = () => Object.fromEntries(SUMMARY_FIELDS.map((field) => [field, 0]));
const roundMetric = (value) => Number((Number(value) || 0).toFixed(8));
const hashStrings = (values) => crypto.createHash('sha256').update([...values].sort().join('\n')).digest('hex');

export const toUtcDay = (value = new Date()) => {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
};

const buildChecksum = (events) => crypto.createHash('sha256').update(
  events.map((event) => JSON.stringify({
    id: String(event._id),
    updatedAt: new Date(event.updatedAt || event.createdAt || 0).toISOString(),
    sessionId: event.sessionId || null,
    provider: event.provider || null,
    modality: event.modality || null,
    stage: event.stage || null,
    operation: event.operation || null,
    action: event.action || null,
    estimatedCost: Number(event.estimatedCost || 0),
    metrics: event.metrics || null,
    promptTokens: Number(event.promptTokens || 0),
    completionTokens: Number(event.completionTokens || 0),
  })).sort().join('\n'),
).digest('hex');

const addProviderUsage = (providers, provider, values) => {
  const current = providers.get(provider) || {
    provider,
    totalCostUsd: 0,
    totalTokens: 0,
    promptTokens: 0,
    completionTokens: 0,
    audioSeconds: 0,
    textCharacters: 0,
    audioBytes: 0,
    requestCount: 0,
  };
  for (const [key, value] of Object.entries(values)) {
    current[key] = roundMetric(current[key] + Number(value || 0));
  }
  providers.set(provider, current);
};

const finalizeRollup = ({ events, userId, day, source, summary, providers }) => ({
  userId,
  source,
  day: toUtcDay(day),
  summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, roundMetric(value)])),
  providerTotals: [...providers.values()].sort((left, right) => left.provider.localeCompare(right.provider)),
  sessionIds: [...new Set(events.map((event) => event.sessionId).filter(Boolean))].sort(),
  sourceEventIds: events.map((event) => String(event._id)).sort(),
  sourceEventCount: events.length,
  sourceChecksum: buildChecksum(events),
  verifiedAt: new Date(),
});

export const buildAiUsageDailyRollup = (events = [], { userId, day } = {}) => {
  const summary = emptyRollupSummary();
  const providers = new Map();
  for (const event of events) {
    const metrics = event.metrics || {};
    const requestCount = Number(metrics.requestCount || 1);
    const values = {
      totalCostUsd: event.estimatedCost,
      totalTokens: metrics.totalTokens,
      promptTokens: metrics.promptTokens,
      completionTokens: metrics.completionTokens,
      audioSeconds: metrics.audioSeconds,
      textCharacters: metrics.textCharacters,
      audioBytes: metrics.audioBytes,
      requestCount,
    };
    summary.totalCostUsd += Number(values.totalCostUsd || 0);
    summary.totalPromptTokens += Number(values.promptTokens || 0);
    summary.totalCompletionTokens += Number(values.completionTokens || 0);
    summary.totalTokens += Number(values.totalTokens || 0);
    summary.speechAudioSeconds += Number(values.audioSeconds || 0);
    summary.speechTextCharacters += Number(values.textCharacters || 0);
    summary.speechAudioBytes += Number(values.audioBytes || 0);
    summary.callCount += requestCount;
    addProviderUsage(providers, event.provider || 'unknown', values);
  }
  return finalizeRollup({ events, userId, day, source: AI_USAGE_ROLLUP_SOURCE, summary, providers });
};

export const buildTokenUsageDailyRollup = (events = [], { userId, day } = {}) => {
  const summary = emptyRollupSummary();
  const providers = new Map();
  for (const event of events) {
    const promptTokens = Number(event.promptTokens || 0);
    const completionTokens = Number(event.completionTokens || 0);
    const values = {
      totalCostUsd: event.estimatedCost,
      totalTokens: promptTokens + completionTokens,
      promptTokens,
      completionTokens,
      requestCount: 1,
    };
    summary.totalCostUsd += Number(event.estimatedCost || 0);
    summary.totalPromptTokens += promptTokens;
    summary.totalCompletionTokens += completionTokens;
    summary.totalTokens += promptTokens + completionTokens;
    summary.callCount += 1;
    addProviderUsage(providers, 'deepseek', values);
  }
  return finalizeRollup({ events, userId, day, source: TOKEN_USAGE_ROLLUP_SOURCE, summary, providers });
};

export const combineUsageRollups = (rollups = []) => {
  const summary = emptyRollupSummary();
  const sessionIds = new Set();
  const providers = new Map();
  for (const rollup of rollups) {
    for (const field of SUMMARY_FIELDS) summary[field] += Number(rollup.summary?.[field] || 0);
    for (const sessionId of rollup.sessionIds || []) sessionIds.add(sessionId);
    for (const provider of rollup.providerTotals || []) {
      const { provider: providerId, ...values } = provider;
      addProviderUsage(providers, providerId, values);
    }
  }
  return {
    summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, roundMetric(value)])),
    measuredSessions: sessionIds.size,
    providerTotals: [...providers.values()].sort((left, right) => left.provider.localeCompare(right.provider)),
  };
};

const groupEventsByUserDay = ({ events, source, buildRollup }) => {
  const groups = new Map();
  for (const event of events) {
    const day = toUtcDay(event.createdAt);
    const key = `${event.userId}:${day.toISOString()}`;
    const group = groups.get(key) || { userId: String(event.userId), day, events: [] };
    group.events.push(event);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => buildRollup(group.events, group)).map((rollup) => ({
    ...rollup,
    source,
  }));
};

export const buildUsageRollupBackfillPlan = ({ aiEvents = [], tokenEvents = [] } = {}) => [
  ...groupEventsByUserDay({
    events: aiEvents,
    source: AI_USAGE_ROLLUP_SOURCE,
    buildRollup: buildAiUsageDailyRollup,
  }),
  ...groupEventsByUserDay({
    events: tokenEvents,
    source: TOKEN_USAGE_ROLLUP_SOURCE,
    buildRollup: buildTokenUsageDailyRollup,
  }),
].sort((left, right) => (
  left.source.localeCompare(right.source)
  || left.userId.localeCompare(right.userId)
  || left.day.getTime() - right.day.getTime()
));

const comparableSummary = (summary = {}) => Object.fromEntries(
  SUMMARY_FIELDS.map((field) => [field, roundMetric(summary[field])]),
);

export const verifyUsageRollupBackfill = ({ events = [], rollups = [], source }) => {
  const expectedRollups = buildUsageRollupBackfillPlan({
    aiEvents: source === AI_USAGE_ROLLUP_SOURCE ? events : [],
    tokenEvents: source === TOKEN_USAGE_ROLLUP_SOURCE ? events : [],
  });
  const expectedIds = events.map((event) => String(event._id)).sort();
  const actualIds = rollups.flatMap((rollup) => rollup.sourceEventIds || []).map(String).sort();
  const expectedCombined = combineUsageRollups(expectedRollups);
  const actualCombined = combineUsageRollups(rollups);
  const metricsMatch = JSON.stringify(comparableSummary(actualCombined.summary))
    === JSON.stringify(comparableSummary(expectedCombined.summary));
  const coverageMatch = JSON.stringify(actualIds) === JSON.stringify(expectedIds);
  const expectedByDay = new Map(expectedRollups.map((rollup) => [rollup.day.toISOString(), rollup]));
  const dailyChecksumsMatch = rollups.length === expectedRollups.length && rollups.every((rollup) => (
    rollup.sourceChecksum === expectedByDay.get(new Date(rollup.day).toISOString())?.sourceChecksum
  ));
  const sessionsMatch = actualCombined.measuredSessions === expectedCombined.measuredSessions;

  return {
    verified: metricsMatch && coverageMatch && dailyChecksumsMatch && sessionsMatch,
    metricsMatch,
    coverageMatch,
    dailyChecksumsMatch,
    sessionsMatch,
    sourceEventCount: expectedIds.length,
    sourceEventChecksum: hashStrings(expectedIds),
    measuredSessions: expectedCombined.measuredSessions,
    expectedSummary: comparableSummary(expectedCombined.summary),
    actualSummary: comparableSummary(actualCombined.summary),
  };
};

export const shouldReplaceUsageRollup = (existing, candidate) => !existing
  || Number(candidate.sourceEventCount) > Number(existing.sourceEventCount)
  || (
    Number(candidate.sourceEventCount) === Number(existing.sourceEventCount)
    && candidate.sourceChecksum !== existing.sourceChecksum
  );

const refreshDailyRollup = async ({ Model, buildRollup, source, userId, day }) => {
  const start = toUtcDay(day);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  const key = { userId, source, day: start };

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const events = await Model.find({ userId, createdAt: { $gte: start, $lt: end } }).lean();
    if (!events.length) return null;
    const candidate = buildRollup(events, { userId, day: start });
    const existing = await UsageDailyRollup.findOne(key).lean();
    if (!shouldReplaceUsageRollup(existing, candidate)) return existing;

    if (!existing) {
      try {
        return await UsageDailyRollup.create(candidate);
      } catch (error) {
        if (error?.code !== 11000) throw error;
        continue;
      }
    }

    const updated = await UsageDailyRollup.findOneAndUpdate(
      { ...key, sourceChecksum: existing.sourceChecksum },
      { $set: candidate },
      { new: true },
    );
    if (updated) return updated;
  }
  throw new Error(`Could not refresh ${source} rollup after concurrent updates`);
};

export const refreshAiUsageDailyRollup = ({ userId, day }) => refreshDailyRollup({
  Model: AiUsageEvent,
  buildRollup: buildAiUsageDailyRollup,
  source: AI_USAGE_ROLLUP_SOURCE,
  userId,
  day,
});

export const refreshTokenUsageDailyRollup = ({ userId, day }) => refreshDailyRollup({
  Model: TokenUsage,
  buildRollup: buildTokenUsageDailyRollup,
  source: TOKEN_USAGE_ROLLUP_SOURCE,
  userId,
  day,
});

export const getUserUsageRollups = (userId, source) => UsageDailyRollup
  .find({ userId, source, verifiedAt: { $type: 'date' } })
  .sort({ day: 1 })
  .lean();
