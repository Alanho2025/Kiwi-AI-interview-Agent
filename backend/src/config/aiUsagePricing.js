/**
 * File responsibility: Central AI provider pricing assumptions for usage estimates.
 * Keep values configurable because provider prices can change without code changes.
 */

const numberFromEnv = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export const AI_USAGE_PRICING_VERSION = process.env.AI_USAGE_PRICING_VERSION || '2026-05-default';

export const AI_USAGE_CURRENCY = {
  providerCurrency: 'USD',
  reportCurrency: 'NZD',
  usdToNzdRate: numberFromEnv('AI_USAGE_USD_TO_NZD_RATE', 1.65),
};

export const DEEPSEEK_CHAT_PRICING = {
  inputCacheHitPer1M: numberFromEnv('DEEPSEEK_INPUT_CACHE_HIT_PER_1M_USD', 0.07),
  inputCacheMissPer1M: numberFromEnv('DEEPSEEK_INPUT_CACHE_MISS_PER_1M_USD', 0.27),
  outputPer1M: numberFromEnv('DEEPSEEK_OUTPUT_PER_1M_USD', 1.10),
};

export const AZURE_SPEECH_PRICING = {
  sttPerAudioHour: numberFromEnv('AZURE_SPEECH_STT_PER_AUDIO_HOUR_USD', 1.00),
  ttsPer1MCharacters: numberFromEnv('AZURE_SPEECH_TTS_PER_1M_CHARS_USD', 16.00),
};

export const COMMERCIAL_STRESS_ASSUMPTIONS = {
  conservativeMinutesReplaced: numberFromEnv('COMMERCIAL_STRESS_CONSERVATIVE_MINUTES', 30),
  moderateMinutesReplaced: numberFromEnv('COMMERCIAL_STRESS_MODERATE_MINUTES', 60),
  hourlyLaborRate: numberFromEnv('COMMERCIAL_STRESS_HOURLY_RATE_NZD', 35),
};

export const calculateDeepSeekCost = ({
  promptTokens = 0,
  completionTokens = 0,
  promptCacheHitTokens = 0,
  promptCacheMissTokens = null,
} = {}) => {
  const normalizedPromptTokens = Math.max(0, Number(promptTokens) || 0);
  const normalizedCompletionTokens = Math.max(0, Number(completionTokens) || 0);
  const normalizedCacheHitTokens = Math.max(0, Number(promptCacheHitTokens) || 0);
  const normalizedCacheMissTokens = promptCacheMissTokens == null
    ? Math.max(0, normalizedPromptTokens - normalizedCacheHitTokens)
    : Math.max(0, Number(promptCacheMissTokens) || 0);

  const inputCost = (normalizedCacheHitTokens / 1_000_000) * DEEPSEEK_CHAT_PRICING.inputCacheHitPer1M
    + (normalizedCacheMissTokens / 1_000_000) * DEEPSEEK_CHAT_PRICING.inputCacheMissPer1M;
  const outputCost = (normalizedCompletionTokens / 1_000_000) * DEEPSEEK_CHAT_PRICING.outputPer1M;

  return Number((inputCost + outputCost).toFixed(8));
};

export const calculateAzureSttCost = ({ audioSeconds = 0 } = {}) => {
  const seconds = Math.max(0, Number(audioSeconds) || 0);
  return Number(((seconds / 3600) * AZURE_SPEECH_PRICING.sttPerAudioHour).toFixed(8));
};

export const calculateAzureTtsCost = ({ textCharacters = 0 } = {}) => {
  const characters = Math.max(0, Number(textCharacters) || 0);
  return Number(((characters / 1_000_000) * AZURE_SPEECH_PRICING.ttsPer1MCharacters).toFixed(8));
};