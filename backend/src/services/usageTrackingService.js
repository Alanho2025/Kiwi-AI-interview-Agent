/**
 * File responsibility: Token usage tracking service.
 * Records DeepSeek API token consumption per user/session.
 * Provides aggregated summary and recent session breakdowns.
 */

import { TokenUsage } from '../db/models/tokenUsageModel.js';

// DeepSeek Chat pricing (as of 2025): https://api-docs.deepseek.com/quick_start/pricing
const PRICING = {
  inputPer1M:  0.14,   // $0.14 / 1M prompt tokens
  outputPer1M: 0.28,   // $0.28 / 1M completion tokens
};

const calcCost = (promptTokens, completionTokens) => {
  const inputCost  = (promptTokens     / 1_000_000) * PRICING.inputPer1M;
  const outputCost = (completionTokens  / 1_000_000) * PRICING.outputPer1M;
  return Number((inputCost + outputCost).toFixed(8));
};

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

  const [stats, count] = await Promise.all([
    TokenUsage.aggregate([
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
    ]),
    TokenUsage.countDocuments({ userId }),
  ]);

  const s = stats?.[0] || { totalPromptTokens: 0, totalCompletionTokens: 0, totalCost: 0, callCount: 0 };

  return {
    totalPromptTokens:     s.totalPromptTokens,
    totalCompletionTokens: s.totalCompletionTokens,
    totalTokens:           s.totalPromptTokens + s.totalCompletionTokens,
    totalCost:             Number(s.totalCost.toFixed(6)),
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
    sessionId:        r._id,
    promptTokens:     r.promptTokens,
    completionTokens: r.completionTokens,
    totalTokens:      r.promptTokens + r.completionTokens,
    estimatedCost:    Number(r.estimatedCost.toFixed(6)),
    callCount:        r.callCount,
    lastUsed:         r.lastUsed,
  }));
};
