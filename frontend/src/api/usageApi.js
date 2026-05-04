/**
 * File responsibility: Token usage API helpers.
 * Provides access to DeepSeek token consumption data and cost estimation.
 */

import { apiGet } from './client.js';

/**
 * Get cumulative token usage summary for the current user.
 * Returns { totalPromptTokens, totalCompletionTokens, totalTokens, totalCost, callCount, pricing }
 */
export const getUsageSummary = () => apiGet('usage/summary');

/**
 * Get recent session-level token usage breakdown.
 * Returns array of { sessionId, promptTokens, completionTokens, totalTokens, estimatedCost, callCount, lastUsed }
 * @param {number} limit - number of recent sessions (default 5, max 20)
 */
export const getRecentSessionUsage = (limit = 5) => apiGet(`usage/recent-sessions?limit=${limit}`);
