/**
 * File responsibility: Orchestrate agentic safeguard control for JD parsing.
 * Main responsibilities:
 * - Run the original parser first.
 * - Let a DeepSeek critic block unsafe field-level output.
 * - Re-run the original parser once with critic-guided section overrides before returning to UI/match.
 */

import { buildStructuredJobDescriptionRubric } from './jobDescriptionRubricBuilder.js';
import { validateJobDescriptionRubric } from './jobDescriptionSchemaValidator.js';
import { shouldRunAgenticSafeguard, buildSkippedSafeguardResult, getMaxSafeguardReparseAttempts } from '../agenticSafeguards/safeguardShared.js';
import { reviewJdParseWithDeepSeek } from './jdParseCriticAgent.js';
import { buildJdReparseOverridesWithDeepSeek } from './jdParseReparseAgent.js';
import { decideJdParseGate } from './jdParseGateService.js';

const attachSafeguard = (rubric = {}, safeguard = {}) => validateJobDescriptionRubric({
  ...rubric,
  safeguard,
  metadata: {
    ...(rubric.metadata || {}),
    safeguard,
  },
});

export const buildGuardedStructuredJobDescriptionRubric = async (rawJD = '') => {
  const firstParsed = await buildStructuredJobDescriptionRubric(rawJD);

  if (!shouldRunAgenticSafeguard()) {
    return attachSafeguard(firstParsed, buildSkippedSafeguardResult('Agentic safeguards disabled.'));
  }

  const maxReparseAttempts = getMaxSafeguardReparseAttempts();
  const firstReview = await reviewJdParseWithDeepSeek({ rawJD, parsedJD: firstParsed });
  const firstGate = decideJdParseGate({ review: firstReview, attempt: 1, maxReparseAttempts });

  if (!firstGate.shouldReparse) {
    return attachSafeguard(firstParsed, {
      ...firstReview,
      parseAttempts: 1,
      repairApplied: false,
      finalStatus: firstGate.finalStatus,
      blockMatch: firstGate.blockMatch || firstReview.blockMatch,
    });
  }

  const sectionOverrides = await buildJdReparseOverridesWithDeepSeek({
    rawJD,
    previousParsedJD: firstParsed,
    criticFeedback: firstReview,
  });

  const secondParsed = await buildStructuredJobDescriptionRubric(rawJD, {
    reparseMode: true,
    criticFeedback: firstReview,
    sectionOverrides,
  });

  const secondReview = await reviewJdParseWithDeepSeek({ rawJD, parsedJD: secondParsed });
  const secondGate = decideJdParseGate({ review: secondReview, attempt: 2, maxReparseAttempts });

  return attachSafeguard(secondParsed, {
    ...secondReview,
    parseAttempts: 2,
    repairApplied: true,
    firstReview,
    sectionOverrides,
    finalStatus: secondGate.finalStatus,
    blockMatch: secondGate.blockMatch || secondReview.blockMatch,
  });
};
