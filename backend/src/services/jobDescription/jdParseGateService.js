/**
 * File responsibility: Master gate for JD parse safeguard decisions.
 * Main responsibilities:
 * - Decide whether a parsed JD can be returned or must be reparsed/blocked.
 * - Keep DeepSeek as a critic, not the final controller.
 */

import { SAFEGUARD_VERDICTS } from '../agenticSafeguards/safeguardShared.js';

export const decideJdParseGate = ({ review, attempt = 1, maxReparseAttempts = 1 } = {}) => {
  if (!review) {
    return {
      canReturn: true,
      shouldReparse: false,
      blockMatch: false,
      finalStatus: 'accepted_without_review',
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

  if (review.verdict === SAFEGUARD_VERDICTS.REVISE && attempt <= maxReparseAttempts) {
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
