/**
 * File responsibility: Stage-level AI usage tracking and commercial cost aggregation.
 */

import { AiUsageEvent } from '../db/models/aiUsageEventModel.js';
import {
  AI_USAGE_PRICING_VERSION,
  AZURE_SPEECH_PRICING,
  COMMERCIAL_STRESS_ASSUMPTIONS,
  DEEPSEEK_CHAT_PRICING,
  calculateAzureSttCost,
  calculateAzureTtsCost,
  calculateDeepSeekCost,
} from '../config/aiUsagePricing.js';

const DEFAULT_STAGE_LABELS = {
  cv_parse: 'CV parse',
  jd_parse: 'JD parse',
  cv_jd_match: 'CV-JD match',
  interview: 'Interview',
  report_generated: 'Report generation',
  report_qa: 'Report QA',
};

const PROVIDER_LABELS = {
  deepseek: 'DeepSeek',
  azure_speech: 'Azure Speech',
  local: 'Local',
};

const roundCost = (value) => Number((Number(value) || 0).toFixed(8));
const roundDisplayCost = (value) => Number((Number(value) || 0).toFixed(6));
const toPositiveNumber = (value) => Math.max(0, Number(value) || 0);
const shouldDebugUsage = () => process.env.AI_USAGE_DEBUG === 'true';

const debugUsageEvent = (event) => {
  if (!shouldDebugUsage()) return;
  console.log('[AI-USAGE-EVENT]', {
    userId: event.userId,
    sessionId: event.sessionId,
    provider: event.provider,
    stage: event.stage,
    operation: event.operation,
    metrics: event.metrics,
    estimatedCost: event.estimatedCost,
    pricingVersion: event.pricingVersion,
  });
};

const sanitizeMetrics = (metrics = {}) => Object.fromEntries(
  Object.entries(metrics || {}).filter(([, value]) => value !== undefined && value !== null)
);

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
  stage = 'interview',
  operation,
  audioSeconds = 0,
  textCharacters = 0,
  audioBytes = 0,
  requestCount = 1,
  metadata = {},
} = {}) => {
  const estimatedCost = operation === 'speech_to_text'
    ? calculateAzureSttCost({ audioSeconds })
    : calculateAzureTtsCost({ textCharacters });

  return recordAiUsageEvent({
    userId,
    sessionId,
    provider: 'azure_speech',
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

const emptySummary = () => ({
  totalCost: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  speechAudioSeconds: 0,
  speechTextCharacters: 0,
  speechAudioBytes: 0,
  callCount: 0,
  measuredSessions: 0,
  providerBreakdown: [],
  pricing: {
    version: AI_USAGE_PRICING_VERSION,
    deepseek: DEEPSEEK_CHAT_PRICING,
    azureSpeech: AZURE_SPEECH_PRICING,
  },
});

const summarizeEvents = (events = []) => events.reduce((acc, event) => {
  const metrics = event.metrics || {};
  acc.totalCost += Number(event.estimatedCost || 0);
  acc.totalPromptTokens += Number(metrics.promptTokens || 0);
  acc.totalCompletionTokens += Number(metrics.completionTokens || 0);
  acc.totalTokens += Number(metrics.totalTokens || 0);
  acc.speechAudioSeconds += Number(metrics.audioSeconds || 0);
  acc.speechTextCharacters += Number(metrics.textCharacters || 0);
  acc.speechAudioBytes += Number(metrics.audioBytes || 0);
  acc.callCount += Number(metrics.requestCount || 1);
  return acc;
}, emptySummary());

const buildBreakdown = (events = [], key) => {
  const grouped = new Map();
  for (const event of events) {
    const groupKey = event[key] || 'unknown';
    const current = grouped.get(groupKey) || {
      id: groupKey,
      label: key === 'stage' ? DEFAULT_STAGE_LABELS[groupKey] || groupKey : PROVIDER_LABELS[groupKey] || groupKey,
      estimatedCost: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      audioSeconds: 0,
      textCharacters: 0,
      audioBytes: 0,
      requestCount: 0,
      providers: new Set(),
    };
    const metrics = event.metrics || {};
    current.estimatedCost += Number(event.estimatedCost || 0);
    current.totalTokens += Number(metrics.totalTokens || 0);
    current.promptTokens += Number(metrics.promptTokens || 0);
    current.completionTokens += Number(metrics.completionTokens || 0);
    current.audioSeconds += Number(metrics.audioSeconds || 0);
    current.textCharacters += Number(metrics.textCharacters || 0);
    current.audioBytes += Number(metrics.audioBytes || 0);
    current.requestCount += Number(metrics.requestCount || 1);
    current.providers.add(event.provider);
    grouped.set(groupKey, current);
  }

  return Array.from(grouped.values()).map((item) => ({
    ...item,
    estimatedCost: roundDisplayCost(item.estimatedCost),
    providers: Array.from(item.providers).map((provider) => PROVIDER_LABELS[provider] || provider),
  }));
};

const buildCommercialStressPayload = (summary, stageBreakdown = []) => {
  const minMinutes = COMMERCIAL_STRESS_ASSUMPTIONS.conservativeMinutesReplaced;
  const maxMinutes = COMMERCIAL_STRESS_ASSUMPTIONS.moderateMinutesReplaced;
  const hourlyRate = COMMERCIAL_STRESS_ASSUMPTIONS.hourlyLaborRate;
  const lowHumanValue = (minMinutes / 60) * hourlyRate;
  const highHumanValue = (maxMinutes / 60) * hourlyRate;
  const totalCost = Number(summary.totalCost || 0);
  const costToValueRatio = highHumanValue > 0 ? totalCost / highHumanValue : 0;
  const estimatedSavingsLow = Math.max(0, lowHumanValue - totalCost);
  const estimatedSavingsHigh = Math.max(0, highHumanValue - totalCost);

  return {
    totalExecutionCost: roundDisplayCost(totalCost),
    totalLlmTokens: summary.totalTokens,
    speechAudioSeconds: Math.round(summary.speechAudioSeconds),
    speechTextCharacters: summary.speechTextCharacters,
    estimatedHumanMinutesReplaced: { min: minMinutes, max: maxMinutes },
    assumedHourlyLaborRate: hourlyRate,
    estimatedHumanLaborValue: {
      min: roundDisplayCost(lowHumanValue),
      max: roundDisplayCost(highHumanValue),
    },
    estimatedSavings: {
      min: roundDisplayCost(estimatedSavingsLow),
      max: roundDisplayCost(estimatedSavingsHigh),
    },
    costToValueRatio: Number(costToValueRatio.toFixed(6)),
    stageBreakdown,
    conclusion: totalCost > 0
      ? 'This session estimated AI service cost is materially lower than equivalent manual CV review, interview delivery, and feedback writing under conservative labor assumptions.'
      : 'This session currently shows no measured external AI service cost; local workflow stages are included as zero-cost steps where recorded.',
    assumptions: `Assumes ${minMinutes}-${maxMinutes} minutes of human review/coaching time at $${hourlyRate}/hour. Provider cost is estimated from recorded usage.`,
  };
};

export const getUserAiUsageSummary = async (userId) => {
  if (!userId) return emptySummary();

  const events = await AiUsageEvent.find({ userId }).lean();
  const summary = summarizeEvents(events);
  const sessionIds = new Set(events.map((event) => event.sessionId).filter(Boolean));
  return {
    ...summary,
    totalCost: roundDisplayCost(summary.totalCost),
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
      estimatedCost: roundDisplayCost(summary.totalCost),
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
      totalCost: roundDisplayCost(summary.totalCost),
      measuredSessions: events.length ? 1 : 0,
      providerBreakdown: buildBreakdown(events, 'provider'),
      pricing: emptySummary().pricing,
    },
    stageBreakdown,
    commercialStressTest: buildCommercialStressPayload(summary, stageBreakdown),
    events,
  };
};
