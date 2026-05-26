/**
 * File responsibility: Token usage tracking service.
 * Records DeepSeek API token consumption per user/session.
 * Provides aggregated summary and recent session breakdowns.
 */

import { TokenUsage } from '../db/models/tokenUsageModel.js';
import {
  AI_USAGE_COST_CURRENCY,
  AI_USAGE_USD_TO_COST_CURRENCY_RATE,
  DEEPSEEK_CHAT_PRICING,
  calculateDeepSeekCost,
  convertUsdCostToUsageCurrency,
} from '../config/aiUsagePricing.js';

const PRICING = {
  currency: AI_USAGE_COST_CURRENCY,
  sourceCurrency: 'USD',
  usdToCurrencyRate: AI_USAGE_COST_CURRENCY === 'USD' ? 1 : AI_USAGE_USD_TO_COST_CURRENCY_RATE,
  inputPer1M: DEEPSEEK_CHAT_PRICING.inputCacheMissPer1M,
  outputPer1M: DEEPSEEK_CHAT_PRICING.outputPer1M,
};

const calcCost = (promptTokens, completionTokens) => calculateDeepSeekCost({ promptTokens, completionTokens });
const toUsageCurrencyCost = (value) => convertUsdCostToUsageCurrency(value);

/**
 * Record a single DeepSeek API call's token usage.
 */
export const recordTokenUsage = async ({ userId, sessionId = null, action, promptTokens, completionTokens }) => {
  if (!userId) return;
  const estimatedCost = calcCost(promptTokens, completionTokens);
  await TokenUsage.create({ userId, sessionId, action, promptTokens, completionTokens, estimatedCost });
};

/**
 * Get cumulative token usage summary for a user.
 */
export const getUsageSummary = async (userId) => {
  if (!userId) return null;

  const stats = await TokenUsage.aggregate([
    { $match: { userId } },
    {
      $group: {
        _id: null,
        totalPromptTokens:     { $sum: '$promptTokens' },
        totalCompletionTokens: { $sum: '$completionTokens' },
        totalCost:             { $sum: '$estimatedCost' },
        callCount:             { $sum: 1 },
      },
    },
  ]);

  const s = stats?.[0] || { totalPromptTokens: 0, totalCompletionTokens: 0, totalCost: 0, callCount: 0 };

  return {
    currency:              AI_USAGE_COST_CURRENCY,
    totalPromptTokens:     s.totalPromptTokens,
    totalCompletionTokens: s.totalCompletionTokens,
    totalTokens:           s.totalPromptTokens + s.totalCompletionTokens,
    totalCost:             Number(toUsageCurrencyCost(s.totalCost).toFixed(6)),
    callCount:             s.callCount,
    pricing:               PRICING,
  };
};

/**
 * Get recent session-level token usage breakdown for a user.
 * Returns the latest N sessions that have usage data.
 */
export const getRecentSessionUsage = async (userId, limit = 5) => {
  if (!userId) return [];

  const results = await TokenUsage.aggregate([
    { $match: { userId, sessionId: { $ne: null } } },
    {
      $group: {
        _id: '$sessionId',
        promptTokens:     { $sum: '$promptTokens' },
        completionTokens: { $sum: '$completionTokens' },
        estimatedCost:    { $sum: '$estimatedCost' },
        callCount:        { $sum: 1 },
        lastUsed:         { $max: '$createdAt' },
      },
    },
    { $sort: { lastUsed: -1 } },
    { $limit: limit },
  ]);

  return results.map((r) => ({
    currency:         AI_USAGE_COST_CURRENCY,
    sessionId:        r._id,
    promptTokens:     r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens:      r.promptTokens + r.completionTokens,
    estimatedCost:    Number(toUsageCurrencyCost(r.estimatedCost).toFixed(6)),
    callCount:        r.callCount,
    lastUsed:         r.lastUsed,
  }));
};
