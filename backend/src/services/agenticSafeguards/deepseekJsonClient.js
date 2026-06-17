/**
 * File responsibility: DeepSeek JSON helper for agentic safeguard calls.
 * Main responsibilities:
 * - Keep JSON-only DeepSeek calls predictable.
 * - Provide safe fallback behaviour so robustness tests never depend on the network.
 */

import { callDeepSeek, autoRecordUsage, LLM_CONFIGS } from '../deepseekService.js';
import { safeJsonParse } from '../jobDescription/jobDescriptionShared.js';

const stripJsonFence = (text = '') => String(text || '')
  .replace(/^```json\s*/i, '')
  .replace(/^```\s*/i, '')
  .replace(/```$/i, '')
  .trim();

export const parseJsonSafely = (text, fallback = null) => {
  try {
    return safeJsonParse(stripJsonFence(text));
  } catch {
    return fallback;
  }
};

export const callDeepSeekJson = async ({
  prompt,
  systemInstruction = 'Return valid JSON only. No prose.',
  fallback = {},
  maxRetries = 1,
  usageMetadata = {},
  generationConfig = LLM_CONFIGS.JSON_STRICT,
  timeoutMs,
} = {}) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const { content, usage } = await callDeepSeek(prompt, systemInstruction, {
        skipAutoRecord: true,
        usageMetadata: { operation: 'llm_json', ...usageMetadata },
        generationConfig,
        timeoutMs,
      });
      // Record with distinct action so we can distinguish JSON-wrapper calls
      await autoRecordUsage(usage, 'callDeepSeekJson', { operation: 'llm_json', ...usageMetadata });
      const parsed = parseJsonSafely(content, null);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed;
      }
      lastError = new Error('DeepSeek returned non-JSON output.');
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ...fallback,
    error: lastError?.message || 'DeepSeek JSON call failed.',
  };
};
