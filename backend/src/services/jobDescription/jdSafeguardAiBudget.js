/**
 * File responsibility: JD safeguard AI execution budget helpers.
 * Main responsibilities:
 * - Keep JD parse foreground requests from waiting on slow external AI calls.
 * - Attach fallback metadata so downstream product flow can require review when AI quality checks time out.
 */

const DEFAULT_SAFEGUARD_TIMEOUT_MS = 6000;
const DEFAULT_SKILL_ENHANCEMENT_TIMEOUT_MS = 4000;

const parsePositiveNumber = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getJdSafeguardAiTimeoutMs = () => parsePositiveNumber(
  process.env.JD_SAFEGUARD_AI_TIMEOUT_MS,
  DEFAULT_SAFEGUARD_TIMEOUT_MS,
);

export const getJdAiSkillEnhancementTimeoutMs = () => parsePositiveNumber(
  process.env.JD_AI_SKILL_ENHANCEMENT_TIMEOUT_MS,
  DEFAULT_SKILL_ENHANCEMENT_TIMEOUT_MS,
);

export const getJdSafeguardAiMaxRetries = () => 0;

export const isJdSafeguardTimeoutError = (message = '') => (
  /\b(timeout|timed out|abort|aborted)\b/i.test(String(message || ''))
);

export const buildJdSafeguardProviderMetadata = ({ result = {}, timeoutMs = getJdSafeguardAiTimeoutMs() } = {}) => {
  const providerError = result?.error ? String(result.error) : '';

  return {
    providerFallbackUsed: Boolean(providerError),
    providerError: providerError || null,
    providerTimedOut: providerError ? isJdSafeguardTimeoutError(providerError) : false,
    providerTimeoutMs: timeoutMs,
  };
};
