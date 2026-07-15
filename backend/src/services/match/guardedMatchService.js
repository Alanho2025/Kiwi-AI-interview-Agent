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
import { buildRoleFitDiagnostics } from '../roleFit/roleFitDiagnosticsService.js';
import {
  buildMatchArtifactCacheIdentity,
  readMatchArtifactCache,
  warmReusableArtifactCaches,
  writeMatchArtifactCache,
} from './matchArtifactCacheService.js';
import { markMatchStep, measureMatchStep } from './matchPerformanceTraceService.js';

const attachMatchSafeguard = (matchResult = {}, safeguard = {}, jdSafeguard = null) => ({
  ...matchResult,
  safeguard,
  matchingDetails: {
    ...(matchResult.matchingDetails || {}),
    safeguard,
    ...(jdSafeguard ? { jdSafeguard } : {}),
  },
});

const attachCacheMiss = (matchResult = {}) => ({
  ...matchResult,
  cache: {
    ...(matchResult.cache || {}),
    hit: false,
    source: matchResult.cache?.source || 'fresh_match',
  },
});

const shouldRecompare = ({ review = {}, attempt = 1, maxAttempts = 1 }) => review.verdict === 'revise' && attempt <= maxAttempts;
const getJdSafeguard = (jdRubric = {}) => jdRubric?.safeguard || jdRubric?.metadata?.safeguard || {};
const isHumanReviewedJd = (jdRubric = {}) =>
  jdRubric?.metadata?.humanReviewStatus === 'verified'
  || jdRubric?.diagnostics?.humanReviewStatus === 'verified'
  || jdRubric?.metadata?.inputTrustLevel === 'human_reviewed';

const isVerifiedRoleFit = (jdRubric = {}) => Boolean(
  jdRubric.roleFit?.companyContext?.status === 'ready'
  && jdRubric.roleFit?.review?.status === 'verified'
);

const buildBlockedRoleFitDiagnostics = ({ jdRubric = {}, degradedReason }) => buildRoleFitDiagnostics({
  roleFitProfile: jdRubric.roleFit || {},
  roleEvidenceMap: {},
  proofStrategy: { artifactStatus: 'degraded', degradedReason },
});

const buildRoleFitBlockedResult = (jdRubric = {}) => {
  const roleFitDiagnostics = buildBlockedRoleFitDiagnostics({
    jdRubric,
    degradedReason: 'role_fit_review_required',
  });

  return {
    schemaVersion: 'v3',
    candidateName: 'Candidate',
    jobTitle: jdRubric.title || jdRubric.jobTitle || 'Target Role',
    overallScore: 0,
    matchScore: 0,
    confidence: 0,
    decision: { label: 'manual_review', reasonCodes: ['role_fit_review_required'] },
    parsedCvProfile: {},
    parsedJdProfile: jdRubric,
    macroScores: [],
    microScores: [],
    requirementChecks: [],
    scoreBreakdown: {},
    explanation: {
      strengths: [],
      gaps: [],
      risks: [{ label: 'Review company and role understanding before matching.', evidence: [], detail: 'The role-fit draft has not been verified.' }],
      summary: 'Review company and role understanding before matching.',
    },
    evidenceMap: [],
    roleEvidenceMap: {},
    roleFitDiagnostics,
    sourceSnapshots: [],
    strengths: [],
    gaps: [],
    riskFlags: ['Review company and role understanding before matching.'],
    interviewFocus: [],
    planPreview: 'Verify the role-fit draft before matching.',
    matchingDetails: { roleFitDiagnostics },
    cache: { hit: false, skipped: true, reason: 'role_fit_review_required' },
  };
};

const buildHumanReviewedRubric = (jdRubric = {}, originalSafeguard = {}) => {
  const reviewedSafeguard = {
    ...originalSafeguard,
    blockMatch: false,
    humanReviewOverrideApplied: true,
    originalBlockMatch: true,
    finalStatus: originalSafeguard.finalStatus
      ? `${originalSafeguard.finalStatus}_human_reviewed`
      : 'jd_safeguard_block_match_human_reviewed',
  };

  return {
    ...jdRubric,
    safeguard: reviewedSafeguard,
    metadata: {
      ...(jdRubric.metadata || {}),
      safeguard: reviewedSafeguard,
      humanReviewOverrideApplied: true,
    },
  };
};

const runFreshSafeguardedMatch = async ({ cvInput, rawJD, humanReviewedJdRubric, settings, reviewedJdSafeguard, performanceTrace }) => {
  const firstMatch = await measureMatchStep(
    performanceTrace,
    'match_compare_first',
    () => compareCvToJobDescription(cvInput, rawJD, humanReviewedJdRubric, settings, { performanceTrace }),
    { recompareMode: false },
  );

  if (!shouldRunAgenticSafeguard()) {
    markMatchStep(performanceTrace, 'match_critic_skipped', { reason: 'agentic_safeguards_disabled' });
    return attachCacheMiss(attachMatchSafeguard(firstMatch, buildSkippedSafeguardResult('Agentic safeguards disabled.'), reviewedJdSafeguard));
  }

  const maxAttempts = getMaxSafeguardReparseAttempts();
  const firstReview = await measureMatchStep(performanceTrace, 'match_critic_first_review', () => reviewMatchWithDeepSeek({
    jdRubric: firstMatch.parsedJdProfile || humanReviewedJdRubric,
    cvProfile: firstMatch.parsedCvProfile,
    matchResult: firstMatch,
  }), { maxAttempts });

  if (!shouldRecompare({ review: firstReview, attempt: 1, maxAttempts })) {
    markMatchStep(performanceTrace, 'match_recompare_skipped', {
      verdict: firstReview.verdict,
      maxAttempts,
    });
    return attachCacheMiss(attachMatchSafeguard(firstMatch, {
      ...firstReview,
      compareAttempts: 1,
      finalStatus: firstReview.verdict === 'pass' ? 'accepted_first_match' : 'needs_review_before_recompare',
    }, reviewedJdSafeguard));
  }

  const secondMatch = await measureMatchStep(performanceTrace, 'match_compare_recompare', () => compareCvToJobDescription(cvInput, rawJD, humanReviewedJdRubric, {
    ...settings,
    recompareMode: true,
    criticFeedback: firstReview,
    previousMatchResult: firstMatch,
  }, { performanceTrace }), { recompareMode: true });

  const secondReview = await measureMatchStep(performanceTrace, 'match_critic_second_review', () => reviewMatchWithDeepSeek({
    jdRubric: secondMatch.parsedJdProfile || humanReviewedJdRubric,
    cvProfile: secondMatch.parsedCvProfile,
    matchResult: secondMatch,
  }), { maxAttempts });

  return attachCacheMiss(attachMatchSafeguard(secondMatch, {
    ...secondReview,
    compareAttempts: 2,
    firstReview,
    finalStatus: secondReview.verdict === 'pass' ? 'accepted_after_recompare' : 'needs_review_after_recompare',
  }, reviewedJdSafeguard));
};

export const compareCvToJobDescriptionWithSafeguard = async (cvInput, rawJD, jdRubric, settings = {}, context = {}) => {
  const performanceTrace = context.performanceTrace || null;
  const userId = settings.userId || cvInput?.userId || '';
  if (!isVerifiedRoleFit(jdRubric)) {
    markMatchStep(performanceTrace, 'match_role_fit_blocked', { reason: 'role_fit_review_required' });
    return buildRoleFitBlockedResult(jdRubric);
  }
  const jdSafeguard = getJdSafeguard(jdRubric);
  const isJdMatchBlocked = Boolean(jdSafeguard.blockMatch);
  const humanReviewedJdRubric = isJdMatchBlocked && isHumanReviewedJd(jdRubric)
    ? buildHumanReviewedRubric(jdRubric, jdSafeguard)
    : jdRubric;
  const reviewedJdSafeguard = humanReviewedJdRubric?.metadata?.humanReviewOverrideApplied
    ? humanReviewedJdRubric.safeguard
    : null;

  if (isJdMatchBlocked && !isHumanReviewedJd(jdRubric)) {
    markMatchStep(performanceTrace, 'match_jd_safeguard_blocked', { reason: 'jd_safeguard_blocked_match' });
    const roleFitDiagnostics = buildBlockedRoleFitDiagnostics({
      jdRubric,
      degradedReason: 'jd_safeguard_blocked_match',
    });

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
      roleFitDiagnostics,
      strengths: [],
      gaps: [],
      riskFlags: ['JD needs review before matching.'],
      interviewFocus: [],
      planPreview: 'Review the JD extraction before starting interview planning.',
      matchingDetails: { roleFitDiagnostics },
      safeguard: jdSafeguard,
      cache: { hit: false, skipped: true, reason: 'jd_safeguard_blocked_match' },
    };
  }

  const cacheIdentity = buildMatchArtifactCacheIdentity({
    userId,
    cvInput,
    rawJD,
    jdRubric: humanReviewedJdRubric,
    settings,
  });
  const cachedMatch = await measureMatchStep(
    performanceTrace,
    'match_cache_read',
    () => readMatchArtifactCache({ userId, cacheKey: cacheIdentity.cacheKey, settings }),
    { cacheEligible: Boolean(userId && cacheIdentity.cacheKey) },
  );
  if (cachedMatch) {
    markMatchStep(performanceTrace, 'match_cache_hit', { source: cachedMatch.cache?.source || 'match_artifact_cache' });
    return cachedMatch;
  }
  markMatchStep(performanceTrace, 'match_cache_miss', { cacheEligible: Boolean(userId && cacheIdentity.cacheKey) });

  const freshMatch = await runFreshSafeguardedMatch({
    cvInput,
    rawJD,
    humanReviewedJdRubric,
    settings,
    reviewedJdSafeguard,
    performanceTrace,
  });

  await measureMatchStep(performanceTrace, 'match_cache_write_warm', () => Promise.allSettled([
    writeMatchArtifactCache({ userId, identity: cacheIdentity, matchResult: freshMatch, settings }),
    warmReusableArtifactCaches({
      userId,
      identity: cacheIdentity,
      cvInput,
      rawJD,
      jdRubric: humanReviewedJdRubric,
      matchResult: freshMatch,
      settings,
    }),
  ]), { cacheEligible: Boolean(userId && cacheIdentity.cacheKey) });

  return freshMatch;
};
