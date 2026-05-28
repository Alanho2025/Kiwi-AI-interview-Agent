/**
 * File responsibility: Utility module.
 * Main responsibilities:
 * - Provide pure helper functions for AI usage tracking
 * - Keep cost calculation and data transformation logic reusable
 * Maintenance notes:
 * - All functions here should be pure (no side effects)
 * - Add new tracking helpers here instead of in service files
 */

import {
    AI_USAGE_COST_CURRENCY,
    AI_USAGE_PRICING_VERSION,
    AI_USAGE_USD_TO_COST_CURRENCY_RATE,
    AZURE_SPEECH_PRICING,
    COMMERCIAL_STRESS_ASSUMPTIONS,
    DEEPSEEK_CHAT_PRICING,
    convertUsdCostToUsageCurrency,
    getCurrencyPrefix,
} from '../config/aiUsagePricing.js';
import { DEFAULT_STAGE_LABELS, PROVIDER_LABELS } from '../config/aiUsageTrackingConstants.js';

/**
 * Round cost to 8 decimal places
 */
export const roundCost = (value) => Number((Number(value) || 0).toFixed(8));

/**
 * Round display cost to 6 decimal places
 */
export const roundDisplayCost = (value) => Number((Number(value) || 0).toFixed(6));

/**
 * Convert value to positive number (minimum 0)
 */
export const toPositiveNumber = (value) => Math.max(0, Number(value) || 0);

/**
 * Convert USD cost to usage currency
 */
export const toUsageCurrencyCost = (value) => convertUsdCostToUsageCurrency(value);

/**
 * Check if usage debug mode is enabled
 */
export const shouldDebugUsage = () => process.env.AI_USAGE_DEBUG === 'true';

/**
 * Debug log usage event
 */
export const debugUsageEvent = (event) => {
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

/**
 * Sanitize metrics by removing undefined and null values
 */
export const sanitizeMetrics = (metrics = {}) => Object.fromEntries(
    Object.entries(metrics || {}).filter(([, value]) => value !== undefined && value !== null)
);

/**
 * Create empty summary object
 */
export const emptySummary = () => ({
    currency: AI_USAGE_COST_CURRENCY,
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
        currency: AI_USAGE_COST_CURRENCY,
        sourceCurrency: 'USD',
        usdToCurrencyRate: AI_USAGE_COST_CURRENCY === 'USD' ? 1 : AI_USAGE_USD_TO_COST_CURRENCY_RATE,
        deepseek: DEEPSEEK_CHAT_PRICING,
        azureSpeech: AZURE_SPEECH_PRICING,
    },
});

/**
 * Summarize events into aggregated metrics
 */
export const summarizeEvents = (events = []) => events.reduce((acc, event) => {
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

/**
 * Build breakdown by grouping key (stage or provider)
 */
export const buildBreakdown = (events = [], key) => {
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
        estimatedCostUsd: roundDisplayCost(item.estimatedCost),
        estimatedCost: roundDisplayCost(toUsageCurrencyCost(item.estimatedCost)),
        currency: AI_USAGE_COST_CURRENCY,
        providers: Array.from(item.providers).map((provider) => PROVIDER_LABELS[provider] || provider),
    }));
};

/**
 * Build commercial stress test payload
 */
export const buildCommercialStressPayload = (summary, stageBreakdown = []) => {
    const minMinutes = COMMERCIAL_STRESS_ASSUMPTIONS.conservativeMinutesReplaced;
    const maxMinutes = COMMERCIAL_STRESS_ASSUMPTIONS.moderateMinutesReplaced;
    const hourlyRate = COMMERCIAL_STRESS_ASSUMPTIONS.hourlyLaborRate;
    const currency = COMMERCIAL_STRESS_ASSUMPTIONS.currency;
    const currencyPrefix = getCurrencyPrefix(currency);
    const lowHumanValue = (minMinutes / 60) * hourlyRate;
    const highHumanValue = (maxMinutes / 60) * hourlyRate;
    const totalCostUsd = Number(summary.totalCost || 0);
    const totalCost = roundDisplayCost(toUsageCurrencyCost(totalCostUsd));
    const costToValueRatio = highHumanValue > 0 ? totalCost / highHumanValue : 0;
    const estimatedSavingsLow = Math.max(0, lowHumanValue - totalCost);
    const estimatedSavingsHigh = Math.max(0, highHumanValue - totalCost);

    return {
        currency,
        totalExecutionCost: totalCost,
        totalExecutionCostUsd: roundDisplayCost(totalCostUsd),
        providerCurrency: 'USD',
        usdToNzdRate: AI_USAGE_USD_TO_COST_CURRENCY_RATE,
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
            ? 'This session estimated provider cost is materially lower than equivalent manual CV review, interview delivery, and feedback writing under conservative NZD labor assumptions.'
            : 'This session currently shows no measured external AI provider cost; local workflow stages are included as zero provider-cost steps where recorded.',
        assumptions: `Assumes ${minMinutes}-${maxMinutes} minutes of human review/coaching time at ${currencyPrefix}${hourlyRate}/hour. Provider prices are recorded in USD and converted to ${currency} at ${AI_USAGE_USD_TO_COST_CURRENCY_RATE}.`,
    };
};

// Made with Bob