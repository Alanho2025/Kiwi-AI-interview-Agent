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

const isExplicitFalse = (value) => ['false', '0', 'no', 'off'].includes(String(value || '').toLowerCase());

export const shouldRunAgenticSafeguard = () => {
  if (isExplicitFalse(process.env.AGENTIC_SAFEGUARDS_ENABLED)) return false;
  if (isExplicitFalse(process.env.ENABLE_AGENTIC_SAFEGUARDS)) return false;
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
  return Number.isFinite(configured) && configured >= 0 ? Math.min(configured, 1) : 1;
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

const isNonEmptyString = (value) => typeof value === 'string' && value.trim().length > 0;

export const inspectSafeguardReviewContract = (review = {}) => {
  const contractIssues = [];

  if (!review || typeof review !== 'object' || Array.isArray(review)) {
    return { valid: false, issues: ['review_not_object'] };
  }

  if (!Object.values(SAFEGUARD_VERDICTS).includes(review.verdict)) {
    contractIssues.push('invalid_verdict');
  }

  if (!Array.isArray(review.issues)) {
    contractIssues.push('issues_not_array');
    return { valid: contractIssues.length === 0, issues: contractIssues };
  }

  review.issues.forEach((issue, index) => {
    if (!issue || typeof issue !== 'object' || Array.isArray(issue)) {
      contractIssues.push(`issue_${index}_not_object`);
      return;
    }
    if (!isNonEmptyString(issue.field)) contractIssues.push(`issue_${index}_missing_field`);
    if (!['low', 'medium', 'high'].includes(issue.severity)) contractIssues.push(`issue_${index}_invalid_severity`);
    if (!isNonEmptyString(issue.problem)) contractIssues.push(`issue_${index}_missing_problem`);
    if (!isNonEmptyString(issue.action)) contractIssues.push(`issue_${index}_missing_action`);
  });

  return { valid: contractIssues.length === 0, issues: contractIssues };
};

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
