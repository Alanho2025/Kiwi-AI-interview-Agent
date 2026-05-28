/**
 * File responsibility: Stage-level AI usage tracking and commercial cost aggregation.
 */

import { AiUsageEvent } from '../db/models/aiUsageEventModel.js';
import {
  AI_USAGE_COST_CURRENCY,
  AI_USAGE_PRICING_VERSION,
  calculateAzureSttCost,
  calculateAzureTtsCost,
  calculateDeepSeekCost,
} from '../config/aiUsagePricing.js';
import {
  roundCost,
  roundDisplayCost,
  toPositiveNumber,
  toUsageCurrencyCost,
  debugUsageEvent,
  sanitizeMetrics,
  emptySummary,
  summarizeEvents,
  buildBreakdown,
  buildCommercialStressPayload,
} from '../utils/aiUsageTrackingHelpers.js';

export const recordAiUsageEvent = async ({
  userId,
  sessionId = null,
  provider,
  modality,
  stage,
  operation,
  metrics = {},
  estimatedCost = 0,
  pricingVersion = AI_USAGE_PRICING_VERSION,
  metadata = {},
} = {}) => {
  if (!userId || !provider || !modality || !stage || !operation) return null;

  const eventPayload = {
    userId,
    sessionId: sessionId || null,
    provider,
    modality,
    stage,
    operation,
    metrics: sanitizeMetrics(metrics),
    estimatedCost: roundCost(estimatedCost),
    pricingVersion,
    metadata: sanitizeMetrics(metadata),
  };

  debugUsageEvent(eventPayload);
  return AiUsageEvent.create(eventPayload);
};

export const recordLlmUsage = async ({
  userId,
  sessionId = null,
  stage = 'interview',
  operation = 'llm_chat',
  action = '',
  usage = {},
  metadata = {},
} = {}) => {
  if (!usage) return null;
  const promptTokens = toPositiveNumber(usage.promptTokens);
  const completionTokens = toPositiveNumber(usage.completionTokens);
  const promptCacheHitTokens = toPositiveNumber(usage.promptCacheHitTokens);
  const promptCacheMissTokens = usage.promptCacheMissTokens == null
    ? Math.max(0, promptTokens - promptCacheHitTokens)
    : toPositiveNumber(usage.promptCacheMissTokens);

  return recordAiUsageEvent({
    userId,
    sessionId,
    provider: 'deepseek',
    modality: 'llm',
    stage,
    operation,
    metrics: {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      promptCacheHitTokens,
      promptCacheMissTokens,
      requestCount: 1,
    },
    estimatedCost: calculateDeepSeekCost({
      promptTokens,
      completionTokens,
      promptCacheHitTokens,
      promptCacheMissTokens,
    }),
    metadata: { action, ...metadata },
  });
};

export const recordSpeechUsage = async ({
  userId,
  sessionId = null,
  provider = 'azure_speech',
  stage = 'interview',
  operation,
  audioSeconds = 0,
  textCharacters = 0,
  audioBytes = 0,
  requestCount = 1,
  metadata = {},
} = {}) => {
  const estimatedCost = provider === 'azure_speech'
    ? (operation === 'speech_to_text'
      ? calculateAzureSttCost({ audioSeconds })
      : calculateAzureTtsCost({ textCharacters }))
    : 0;

  return recordAiUsageEvent({
    userId,
    sessionId,
    provider,
    modality: 'speech',
    stage,
    operation,
    metrics: {
      audioSeconds: toPositiveNumber(audioSeconds),
      textCharacters: toPositiveNumber(textCharacters),
      audioBytes: toPositiveNumber(audioBytes),
      requestCount: toPositiveNumber(requestCount) || 1,
    },
    estimatedCost,
    metadata,
  });
};

export const recordLocalUsage = async ({
  userId,
  sessionId = null,
  stage,
  operation = 'local_parse',
  metadata = {},
} = {}) => recordAiUsageEvent({
  userId,
  sessionId,
  provider: 'local',
  modality: 'local',
  stage,
  operation,
  metrics: { requestCount: 1 },
  estimatedCost: 0,
  metadata,
});

export const getUserAiUsageSummary = async (userId) => {
  if (!userId) return emptySummary();

  const events = await AiUsageEvent.find({ userId }).lean();
  const summary = summarizeEvents(events);
  const sessionIds = new Set(events.map((event) => event.sessionId).filter(Boolean));
  return {
    ...summary,
    totalCostUsd: roundDisplayCost(summary.totalCost),
    totalCost: roundDisplayCost(toUsageCurrencyCost(summary.totalCost)),
    currency: AI_USAGE_COST_CURRENCY,
    measuredSessions: sessionIds.size,
    providerBreakdown: buildBreakdown(events, 'provider'),
    pricing: emptySummary().pricing,
  };
};

export const getRecentAiSessionUsage = async (userId, limit = 5) => {
  if (!userId) return [];

  const events = await AiUsageEvent.find({ userId, sessionId: { $ne: null } }).sort({ createdAt: -1 }).lean();
  const grouped = new Map();
  for (const event of events) {
    if (!grouped.has(event.sessionId)) grouped.set(event.sessionId, []);
    grouped.get(event.sessionId).push(event);
  }

  return Array.from(grouped.entries()).slice(0, limit).map(([sessionId, sessionEvents]) => {
    const summary = summarizeEvents(sessionEvents);
    const lastUsed = sessionEvents.reduce((latest, event) => (
      !latest || new Date(event.createdAt) > new Date(latest) ? event.createdAt : latest
    ), null);
    return {
      sessionId,
      totalTokens: summary.totalTokens,
      promptTokens: summary.totalPromptTokens,
      completionTokens: summary.totalCompletionTokens,
      estimatedCostUsd: roundDisplayCost(summary.totalCost),
      estimatedCost: roundDisplayCost(toUsageCurrencyCost(summary.totalCost)),
      currency: AI_USAGE_COST_CURRENCY,
      callCount: summary.callCount,
      speechAudioSeconds: Math.round(summary.speechAudioSeconds),
      providerBreakdown: buildBreakdown(sessionEvents, 'provider'),
      lastUsed,
    };
  });
};

export const getSessionExecutionCost = async ({ userId, sessionId }) => {
  if (!userId || !sessionId) return null;

  const events = await AiUsageEvent.find({ userId, sessionId }).sort({ createdAt: 1 }).lean();
  const summary = summarizeEvents(events);
  const stageBreakdown = buildBreakdown(events, 'stage');

  return {
    sessionId,
    summary: {
      ...summary,
      totalCostUsd: roundDisplayCost(summary.totalCost),
      totalCost: roundDisplayCost(toUsageCurrencyCost(summary.totalCost)),
      currency: AI_USAGE_COST_CURRENCY,
      measuredSessions: events.length ? 1 : 0,
      providerBreakdown: buildBreakdown(events, 'provider'),
      pricing: emptySummary().pricing,
    },
    stageBreakdown,
    commercialStressTest: buildCommercialStressPayload(summary, stageBreakdown),
    events,
  };
};

// Made with Bob
