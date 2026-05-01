/**
 * File responsibility: DeepSeek JSON helper for agentic safeguard calls.
 * Main responsibilities:
 * - Keep JSON-only DeepSeek calls predictable.
 * - Provide safe fallback behaviour so robustness tests never depend on the network.
 */

import { callDeepSeek } from '../deepseekService.js';
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
} = {}) => {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await callDeepSeek(prompt, systemInstruction);
      const parsed = parseJsonSafely(response, null);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
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
