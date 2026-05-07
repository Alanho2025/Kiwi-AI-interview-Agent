/**
 * File responsibility: Shared helpers for controlled agentic safeguards.
 * Main responsibilities:
 * - Keep safeguard verdict names stable across JD parsing and CV-JD matching.
 * - Centralise feature flags so mock tests can opt into review while real flows always run safeguards.
 */

export const SAFEGUARD_VERDICTS = {
  PASS: 'pass',
  REVISE: 'revise',
  REJECT: 'reject',
};

export const isMockAiMode = () => process.env.AI_TEST_MODE === 'mock';
export const isRealAiMode = () => process.env.AI_TEST_MODE === 'real';

export const shouldRunAgenticSafeguard = () => {
  if (isMockAiMode()) return process.env.ENABLE_AGENTIC_SAFEGUARDS === 'true';
  return true;
};

export const assertSafeguardProviderConfigured = () => {
  if (isMockAiMode()) return;
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY is required because agentic safeguards are mandatory outside mock mode.');
  }
};

export const getMaxSafeguardReparseAttempts = () => {
  const configured = Number(process.env.AGENTIC_SAFEGUARD_MAX_REPARSE_ATTEMPTS || 1);
  return Number.isFinite(configured) && configured >= 0 ? Math.min(configured, 2) : 1;
};

export const buildSkippedSafeguardResult = (reason) => ({
  verdict: SAFEGUARD_VERDICTS.PASS,
  confidence: 1,
  blockOutput: false,
  blockMatch: false,
  skipped: true,
  repairApplied: false,
  parseAttempts: 1,
  finalStatus: 'safeguard_skipped',
  issues: [],
  reparseInstructions: [],
  reason,
});

export const normalizeVerdict = (value = '') => {
  const normalized = String(value || '').toLowerCase().trim();
  if (Object.values(SAFEGUARD_VERDICTS).includes(normalized)) return normalized;
  return SAFEGUARD_VERDICTS.REVISE;
};

export const ensureArray = (value) => (Array.isArray(value) ? value.filter(Boolean) : []);

export const normalizeIssue = (issue = {}) => ({
  field: String(issue.field || 'unknown'),
  severity: ['low', 'medium', 'high'].includes(issue.severity) ? issue.severity : 'medium',
  problem: String(issue.problem || issue.reason || 'Unspecified safeguard issue.'),
  action: String(issue.action || issue.suggestedAction || ''),
});

export const normalizeSafeguardReview = (review = {}, fallback = {}) => {
  const verdict = normalizeVerdict(review.verdict || fallback.verdict);
  return {
    verdict,
    confidence: Number.isFinite(Number(review.confidence)) ? Number(review.confidence) : (fallback.confidence ?? 0.5),
    blockOutput: Boolean(review.blockOutput ?? (verdict !== SAFEGUARD_VERDICTS.PASS)),
    blockMatch: Boolean(review.blockMatch ?? (verdict !== SAFEGUARD_VERDICTS.PASS)),
    issues: ensureArray(review.issues || fallback.issues).map(normalizeIssue),
    reparseInstructions: ensureArray(review.reparseInstructions || fallback.reparseInstructions).map(String),
    reasoning: String(review.reasoning || review.reason || fallback.reasoning || ''),
  };
};
