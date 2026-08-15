import { inspectSafeguardReviewContract } from '../../src/services/agenticSafeguards/safeguardShared.js';

const VALID_VERDICTS = new Set(['pass', 'revise', 'reject']);
const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const hasNonEmptyRawString = (value) => typeof value === 'string' && value.trim().length > 0;
const isMissingRawValue = (value) => value === undefined || value === null || (typeof value === 'string' && !value.trim());
const TELEMETRY_ERROR_MAX_LENGTH = 240;
const SENSITIVE_KEY_VALUE_PATTERN = /\b(api[_-]?key|access[_-]?token|authorization|bearer|token|secret|password|client[_-]?secret)\b\s*[:=]\s*(?:(?:bearer)\s+)?(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi;
const BARE_BEARER_PATTERN = /\bBearer\s+[^\s,;]+/gi;

export const sanitizeTelemetryError = (error = '') => {
  const rawValue = error instanceof Error ? error.message : error?.message || error;
  const normalized = String(rawValue || '').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  return normalized
    .replace(SENSITIVE_KEY_VALUE_PATTERN, (_match, key) => `${key}=[REDACTED]`)
    .replace(BARE_BEARER_PATTERN, 'Bearer [REDACTED]')
    .slice(0, TELEMETRY_ERROR_MAX_LENGTH);
};

const addRawIssueSchemaLabels = (schemaIssues, issue) => {
  if (!isRecord(issue)) {
    schemaIssues.add('issue_not_object');
    return;
  }

  if (!hasNonEmptyRawString(issue.field)) {
    schemaIssues.add(isMissingRawValue(issue.field) ? 'issue_missing_field' : 'issue_invalid_field');
  }
  if (!['low', 'medium', 'high'].includes(issue.severity)) {
    schemaIssues.add(isMissingRawValue(issue.severity) ? 'issue_missing_severity' : 'issue_invalid_severity');
  }
  if (!hasNonEmptyRawString(issue.problem)) {
    schemaIssues.add(isMissingRawValue(issue.problem) ? 'issue_missing_problem' : 'issue_invalid_problem');
  }
  if (!hasNonEmptyRawString(issue.action)) {
    schemaIssues.add(isMissingRawValue(issue.action) ? 'issue_missing_action' : 'issue_invalid_action');
  }
};

const normalizeIssue = (issue = {}) => ({
  field: String(issue.field || 'unknown'),
  severity: String(issue.severity || 'unknown'),
  problem: sanitizeTelemetryError(issue.problem || issue.reason),
  action: sanitizeTelemetryError(issue.action || issue.suggestedAction),
});

export const summarizeJdSafeguardReview = (review = null) => {
  const issues = Array.isArray(review?.issues) ? review.issues.map(normalizeIssue) : [];
  const highSeverityIssueCount = issues.filter((issue) => issue.severity === 'high').length;

  return {
    present: Boolean(review),
    verdict: review?.verdict || null,
    verdictWasNormalized: Boolean(review && review.verdict && !VALID_VERDICTS.has(String(review.verdict).toLowerCase())),
    confidence: Number.isFinite(Number(review?.confidence)) ? Number(review.confidence) : null,
    issues,
    issueCount: issues.length,
    highSeverityIssueCount,
    nonHighSeverityIssueCount: issues.length - highSeverityIssueCount,
    providerFallbackUsed: Boolean(review?.providerFallbackUsed),
    providerTimedOut: Boolean(review?.providerTimedOut),
    providerError: review?.providerError || null,
  };
};

export const classifyJdReparseReasons = (review = null) => {
  const summary = summarizeJdSafeguardReview(review);
  const reasons = [];

  if (!summary.present) reasons.push('missing_review');
  if (summary.providerFallbackUsed) reasons.push('provider_fallback');
  if (summary.providerTimedOut) reasons.push('provider_timeout');
  if (summary.verdictWasNormalized) reasons.push('invalid_verdict_after_normalization');

  if (summary.verdict === 'revise') {
    if (summary.highSeverityIssueCount > 0) reasons.push('revise_with_high_severity_issue');
    else if (summary.issueCount > 0) reasons.push('revise_without_high_severity_issue');
    else reasons.push('revise_without_issue');
  }

  return reasons;
};

const summarizeSectionOverrides = (sectionOverrides = {}) => Object.fromEntries(
  Object.entries(sectionOverrides.sections || {}).map(([section, values]) => [
    section,
    { count: Array.isArray(values) ? values.length : 0 },
  ])
);

export const buildJdSafeguardTrace = (rubric = {}) => {
  const safeguard = rubric.safeguard || {};
  const reparsed = Number(safeguard.parseAttempts) > 1;
  const firstReview = reparsed ? safeguard.firstReview : safeguard;
  const secondReview = reparsed ? safeguard : null;

  return {
    parseAttempts: safeguard.parseAttempts ?? null,
    finalStatus: safeguard.finalStatus || null,
    repairApplied: Boolean(safeguard.repairApplied),
    firstReview: summarizeJdSafeguardReview(firstReview),
    firstReviewReparseReasons: classifyJdReparseReasons(firstReview),
    secondReview: summarizeJdSafeguardReview(secondReview),
    secondReviewReparseReasons: classifyJdReparseReasons(secondReview),
    sectionOverrides: reparsed ? summarizeSectionOverrides(safeguard.sectionOverrides) : {},
    reparseProviderFallbackUsed: Boolean(safeguard.sectionOverrides?.metadata?.providerFallbackUsed),
    reparseProviderTimedOut: Boolean(safeguard.sectionOverrides?.metadata?.providerTimedOut),
    reparseProviderError: safeguard.sectionOverrides?.metadata?.providerError || null,
  };
};

const summarizeProviderCalls = (calls = []) => {
  const errors = [...new Set(calls.map((call) => call.error).filter(Boolean))];
  return {
    attempts: calls.length,
    responseJsonValidCount: calls.filter((call) => call.responseJsonValid).length,
    responseBodyReadErrorCount: calls.filter((call) => call.responseBodyRead === false).length,
    schemaValidCount: calls.filter((call) => call.providerResponse?.schemaValid === true).length,
    schemaInvalidCount: calls.filter((call) => call.providerResponse?.schemaValid === false).length,
    timeoutCount: calls.filter((call) => /timeout|abort/i.test(call.error || '')).length,
    errors,
  };
};

export const attachJdReviewProviderTelemetry = (trace = {}, providerCalls = []) => {
  const firstReparseIndex = providerCalls.findIndex((call) => call.flow === 'reparse');
  const firstReviewCalls = firstReparseIndex >= 0
    ? providerCalls.slice(0, firstReparseIndex).filter((call) => call.flow === 'parse_critic')
    : providerCalls.filter((call) => call.flow === 'parse_critic');
  const secondReviewCalls = firstReparseIndex >= 0
    ? providerCalls.slice(firstReparseIndex + 1).filter((call) => call.flow === 'parse_critic')
    : [];

  return {
    ...trace,
    firstReviewProviderCalls: summarizeProviderCalls(firstReviewCalls),
    secondReviewProviderCalls: summarizeProviderCalls(secondReviewCalls),
  };
};

export const summarizeProviderResponse = (content = '') => {
  const text = String(content || '').trim();
  if (!text) {
    return {
      hasContent: false,
      jsonValid: false,
      schemaKind: null,
      schemaValid: null,
      verdict: null,
      verdictValid: null,
      issueCount: null,
      issueObjectCount: null,
      issueNonObjectCount: null,
      issueWithFieldCount: null,
      issueWithSeverityCount: null,
      issueWithProblemCount: null,
      issueWithActionCount: null,
      schemaIssues: [],
    };
  }

  try {
    const parsed = JSON.parse(text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim());
    if (!isRecord(parsed)) {
      return {
        hasContent: true,
        jsonValid: false,
        schemaKind: null,
        schemaValid: false,
        verdict: null,
        verdictValid: null,
        issueCount: null,
        issueObjectCount: null,
        issueNonObjectCount: null,
        issueWithFieldCount: null,
        issueWithSeverityCount: null,
        issueWithProblemCount: null,
        issueWithActionCount: null,
        schemaIssues: ['top_level_not_object'],
      };
    }

    const hasCriticFields = Object.prototype.hasOwnProperty.call(parsed, 'verdict')
      || Object.prototype.hasOwnProperty.call(parsed, 'issues')
      || Object.prototype.hasOwnProperty.call(parsed, 'reparseInstructions');
    const issues = Array.isArray(parsed.issues) ? parsed.issues : [];
    const objectIssues = issues.filter(isRecord);
    const issueWithFieldCount = objectIssues.filter((issue) => hasNonEmptyRawString(issue.field)).length;
    const issueWithSeverityCount = objectIssues.filter((issue) => ['low', 'medium', 'high'].includes(issue.severity)).length;
    const issueWithProblemCount = objectIssues.filter((issue) => hasNonEmptyRawString(issue.problem)).length;
    const issueWithActionCount = objectIssues.filter((issue) => hasNonEmptyRawString(issue.action)).length;
    const schemaIssues = new Set();
    const reviewContract = hasCriticFields ? inspectSafeguardReviewContract(parsed) : null;

    if (hasCriticFields && !VALID_VERDICTS.has(parsed.verdict)) schemaIssues.add('invalid_or_missing_verdict');
    if (hasCriticFields && !Array.isArray(parsed.issues)) schemaIssues.add('issues_not_array');
    if (hasCriticFields) issues.forEach((issue) => addRawIssueSchemaLabels(schemaIssues, issue));

    return {
      hasContent: true,
      jsonValid: true,
      schemaKind: hasCriticFields ? 'critic' : 'other',
      schemaValid: hasCriticFields ? reviewContract.valid : null,
      verdict: parsed?.verdict || null,
      verdictValid: hasCriticFields ? VALID_VERDICTS.has(parsed.verdict) : null,
      issueCount: Array.isArray(parsed.issues) ? parsed.issues.length : null,
      issueObjectCount: Array.isArray(parsed.issues) ? objectIssues.length : null,
      issueNonObjectCount: Array.isArray(parsed.issues) ? issues.length - objectIssues.length : null,
      issueWithFieldCount: Array.isArray(parsed.issues) ? issueWithFieldCount : null,
      issueWithSeverityCount: Array.isArray(parsed.issues) ? issueWithSeverityCount : null,
      issueWithProblemCount: Array.isArray(parsed.issues) ? issueWithProblemCount : null,
      issueWithActionCount: Array.isArray(parsed.issues) ? issueWithActionCount : null,
      schemaIssues: [...schemaIssues],
    };
  } catch {
    return {
      hasContent: true,
      jsonValid: false,
      schemaKind: null,
      schemaValid: false,
      verdict: null,
      verdictValid: null,
      issueCount: null,
      issueObjectCount: null,
      issueNonObjectCount: null,
      issueWithFieldCount: null,
      issueWithSeverityCount: null,
      issueWithProblemCount: null,
      issueWithActionCount: null,
      schemaIssues: ['invalid_json'],
    };
  }
};
