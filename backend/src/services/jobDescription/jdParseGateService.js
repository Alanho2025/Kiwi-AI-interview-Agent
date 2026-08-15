/**
 * File responsibility: Master gate for JD parse safeguard decisions.
 * Main responsibilities:
 * - Decide whether a parsed JD can be returned or must be reparsed/blocked.
 * - Keep DeepSeek as a critic, not the final controller.
 */

import {
  inspectSafeguardReviewContract,
  SAFEGUARD_VERDICTS,
} from '../agenticSafeguards/safeguardShared.js';

const clampMaxReparseAttempts = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.min(parsed, 1) : 1;
};

const hasProviderFailure = (review) => Boolean(
  review.providerFallbackUsed
  || review.providerTimedOut
  || review.providerError,
);

const resolveEffectiveContractValidity = (review) => {
  const inspectedContract = inspectSafeguardReviewContract(review);
  if (review.reviewContractValid === false) return false;
  return inspectedContract.valid;
};

const hasCompleteHighSeverityIssue = (review, contractValid) => (
  contractValid
  && Array.isArray(review.issues)
  && review.issues.some((issue) => (
    issue?.severity === 'high'
    && inspectSafeguardReviewContract({
      verdict: SAFEGUARD_VERDICTS.REVISE,
      issues: [issue],
    }).valid
  ))
);

export const decideJdParseGate = ({ review, attempt = 1, maxReparseAttempts = 1 } = {}) => {
  if (!review) {
    return {
      canReturn: true,
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_missing_review',
    };
  }

  if (hasProviderFailure(review)) {
    return {
      canReturn: true,
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_provider_failure',
    };
  }

  const reviewContractValid = resolveEffectiveContractValidity(review);
  if (!reviewContractValid) {
    return {
      canReturn: true,
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_invalid_review_contract',
    };
  }

  if (review.verdict === SAFEGUARD_VERDICTS.PASS) {
    return {
      canReturn: true,
      shouldReparse: false,
      blockMatch: false,
      finalStatus: attempt > 1 ? 'accepted_after_reparse' : 'accepted_first_parse',
    };
  }

  if (review.verdict === SAFEGUARD_VERDICTS.REVISE && !hasCompleteHighSeverityIssue(review, reviewContractValid)) {
    return {
      canReturn: true,
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_insufficient_high_severity_evidence',
    };
  }

  const boundedMaxReparseAttempts = clampMaxReparseAttempts(maxReparseAttempts);
  if (review.verdict === SAFEGUARD_VERDICTS.REVISE && attempt <= boundedMaxReparseAttempts) {
    return {
      canReturn: false,
      shouldReparse: true,
      blockMatch: true,
      finalStatus: 'reparse_required',
    };
  }

  return {
    canReturn: true,
    shouldReparse: false,
    blockMatch: true,
    finalStatus: attempt > 1 ? 'needs_review_after_reparse' : 'blocked_before_reparse',
  };
};
