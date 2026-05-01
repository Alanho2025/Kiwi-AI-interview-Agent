/**
 * File responsibility: Orchestrate agentic safeguard control for CV-JD matching.
 * Main responsibilities:
 * - Run the original matcher first.
 * - Use DeepSeek as a critic agent to detect overconfidence and unsupported evidence.
 * - Re-run the matcher once with critic feedback before returning a final result.
 */

import { compareCvToJobDescription } from '../matchService.js';
import { shouldRunAgenticSafeguard, buildSkippedSafeguardResult, getMaxSafeguardReparseAttempts } from '../agenticSafeguards/safeguardShared.js';
import { reviewMatchWithDeepSeek } from './matchCriticAgent.js';

const attachMatchSafeguard = (matchResult = {}, safeguard = {}) => ({
  ...matchResult,
  safeguard,
  matchingDetails: {
    ...(matchResult.matchingDetails || {}),
    safeguard,
  },
});

const shouldRecompare = ({ review = {}, attempt = 1, maxAttempts = 1 }) => review.verdict === 'revise' && attempt <= maxAttempts;

export const compareCvToJobDescriptionWithSafeguard = async (cvInput, rawJD, jdRubric, settings = {}) => {
  if (jdRubric?.safeguard?.blockMatch || jdRubric?.metadata?.safeguard?.blockMatch) {
    return {
      schemaVersion: 'v3',
      candidateName: 'Candidate',
      jobTitle: jdRubric.title || jdRubric.jobTitle || 'Target Role',
      overallScore: 0,
      matchScore: 0,
      confidence: 0,
      decision: { label: 'manual_review', reasonCodes: ['jd_safeguard_blocked_match'] },
      parsedCvProfile: {},
      parsedJdProfile: jdRubric,
      macroScores: [],
      microScores: [],
      requirementChecks: [],
      scoreBreakdown: {},
      explanation: { strengths: [], gaps: [], risks: [{ label: 'JD needs review before matching.', evidence: [], detail: 'Agentic safeguard blocked this JD from matching.' }], summary: 'JD needs review before matching.' },
      evidenceMap: [],
      sourceSnapshots: [],
      strengths: [],
      gaps: [],
      riskFlags: ['JD needs review before matching.'],
      interviewFocus: [],
      planPreview: 'Review the JD extraction before starting interview planning.',
      matchingDetails: {},
      safeguard: jdRubric.safeguard || jdRubric.metadata.safeguard,
    };
  }

  const firstMatch = await compareCvToJobDescription(cvInput, rawJD, jdRubric, settings);

  if (!shouldRunAgenticSafeguard()) {
    return attachMatchSafeguard(firstMatch, buildSkippedSafeguardResult('Agentic safeguards disabled.'));
  }

  const maxAttempts = getMaxSafeguardReparseAttempts();
  const firstReview = await reviewMatchWithDeepSeek({
    jdRubric: firstMatch.parsedJdProfile || jdRubric,
    cvProfile: firstMatch.parsedCvProfile,
    matchResult: firstMatch,
  });

  if (!shouldRecompare({ review: firstReview, attempt: 1, maxAttempts })) {
    return attachMatchSafeguard(firstMatch, {
      ...firstReview,
      compareAttempts: 1,
      finalStatus: firstReview.verdict === 'pass' ? 'accepted_first_match' : 'needs_review_before_recompare',
    });
  }

  const secondMatch = await compareCvToJobDescription(cvInput, rawJD, jdRubric, {
    ...settings,
    recompareMode: true,
    criticFeedback: firstReview,
    previousMatchResult: firstMatch,
  });

  const secondReview = await reviewMatchWithDeepSeek({
    jdRubric: secondMatch.parsedJdProfile || jdRubric,
    cvProfile: secondMatch.parsedCvProfile,
    matchResult: secondMatch,
  });

  return attachMatchSafeguard(secondMatch, {
    ...secondReview,
    compareAttempts: 2,
    firstReview,
    finalStatus: secondReview.verdict === 'pass' ? 'accepted_after_recompare' : 'needs_review_after_recompare',
  });
};
