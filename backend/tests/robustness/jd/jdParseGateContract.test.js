import { afterEach, describe, expect, it, vi } from 'vitest';

import { decideJdParseGate } from '../../../src/services/jobDescription/jdParseGateService.js';
import { getMaxSafeguardReparseAttempts } from '../../../src/services/agenticSafeguards/safeguardShared.js';
import { mergeJdReparseReviewProviderMetadata } from '../../../src/services/jobDescription/guardedJobDescriptionService.js';

const callDeepSeekJsonMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/agenticSafeguards/deepseekJsonClient.js', () => ({
  callDeepSeekJson: callDeepSeekJsonMock,
}));

import { reviewJdParseWithDeepSeek } from '../../../src/services/jobDescription/jdParseCriticAgent.js';

const previousEnv = { ...process.env };

const completeHighReview = {
  verdict: 'revise',
  issues: [{
    field: 'sections.responsibilities',
    severity: 'high',
    problem: 'Responsibilities were not extracted.',
    action: 'Re-extract the responsibilities section.',
  }],
};

const completeLowReview = {
  verdict: 'revise',
  issues: [{
    field: 'sections.benefits',
    severity: 'low',
    problem: 'Benefit wording drifted.',
    action: 'Preserve the original benefit wording.',
  }],
};

describe('JD parse review contract and bounded reparse gate', () => {
  afterEach(() => {
    process.env = { ...previousEnv };
    vi.clearAllMocks();
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('blocks a missing %s review instead of accepting without review', (_label, review) => {
    expect(decideJdParseGate({
      review,
      attempt: 1,
      maxReparseAttempts: 1,
    })).toMatchObject({
      canReturn: true,
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_missing_review',
    });
  });

  it('allows one reparse for a complete high-severity revise review', () => {
    expect(decideJdParseGate({
      review: { ...completeHighReview, reviewContractValid: true },
      attempt: 1,
      maxReparseAttempts: 1,
    })).toMatchObject({
      shouldReparse: true,
      blockMatch: true,
      finalStatus: 'reparse_required',
    });
  });

  it('blocks an explicitly invalid review contract even when the normalized issue is complete', () => {
    expect(decideJdParseGate({
      review: { ...completeHighReview, reviewContractValid: false },
      attempt: 1,
      maxReparseAttempts: 1,
    })).toMatchObject({
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_invalid_review_contract',
    });
  });

  it('allows a complete legacy normalized review when reviewContractValid is missing', () => {
    expect(decideJdParseGate({
      review: completeHighReview,
      attempt: 1,
      maxReparseAttempts: 1,
    })).toMatchObject({
      shouldReparse: true,
      blockMatch: true,
      finalStatus: 'reparse_required',
    });
  });

  it('blocks a legacy review with an incomplete issue when reviewContractValid is missing', () => {
    expect(decideJdParseGate({
      review: {
        verdict: 'revise',
        issues: [{ field: 'sections.responsibilities', severity: 'high' }],
      },
      attempt: 1,
      maxReparseAttempts: 1,
    })).toMatchObject({
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_invalid_review_contract',
    });
  });

  it('blocks reparsing when the provider issue schema is incomplete', async () => {
    process.env.AI_TEST_MODE = 'real';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    callDeepSeekJsonMock.mockResolvedValue({
      verdict: 'revise',
      issues: [{ field: 'sections.responsibilities', severity: 'high' }],
    });

    const review = await reviewJdParseWithDeepSeek({ rawJD: 'Responsibilities: build systems.' });
    const gate = decideJdParseGate({ review, attempt: 1, maxReparseAttempts: 1 });

    expect(review).toMatchObject({
      reviewContractValid: false,
      reviewContractStatus: 'invalid',
    });
    expect(review.reviewContractIssues).toEqual(expect.arrayContaining([
      'issue_0_missing_problem',
      'issue_0_missing_action',
    ]));
    expect(gate).toMatchObject({
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_invalid_review_contract',
    });
  });

  it('states the complete issue contract in the critic XML system instructions', async () => {
    process.env.AI_TEST_MODE = 'real';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    callDeepSeekJsonMock.mockResolvedValue({ verdict: 'pass', issues: [] });

    await reviewJdParseWithDeepSeek({ rawJD: 'Responsibilities: build systems.' });

    const [[{ systemInstruction }]] = callDeepSeekJsonMock.mock.calls;
    expect(systemInstruction).toContain('issues field must be an array');
    expect(systemInstruction).toContain('non-empty field');
    expect(systemInstruction).toContain('severity exactly low, medium, or high');
    expect(systemInstruction).toContain('non-empty problem');
    expect(systemInstruction).toContain('non-empty action');
    expect(systemInstruction).toContain('return an empty issues array');
  });

  it.each([
    ['provider timeout', 'The operation was aborted due to timeout.'],
    ['provider fallback', 'DeepSeek JSON call failed.'],
  ])('blocks reparsing for %s', async (_label, error) => {
    process.env.AI_TEST_MODE = 'real';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    callDeepSeekJsonMock.mockResolvedValue({ ...completeHighReview, error });

    const review = await reviewJdParseWithDeepSeek({ rawJD: 'Responsibilities: build systems.' });
    const gate = decideJdParseGate({ review, attempt: 1, maxReparseAttempts: 1 });

    expect(review.providerFallbackUsed).toBe(true);
    expect(gate).toMatchObject({
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_provider_failure',
    });
  });

  it('carries reparse provider failure metadata into the second pass gate', () => {
    const mergedSecondReview = mergeJdReparseReviewProviderMetadata(
      {
        verdict: 'pass',
        issues: [],
        reviewContractValid: true,
        providerFallbackUsed: false,
        providerTimedOut: false,
        providerError: null,
      },
      {
        metadata: {
          providerFallbackUsed: true,
          providerTimedOut: true,
          providerError: 'The reparse provider timed out.',
        },
      },
    );

    expect(mergedSecondReview).toMatchObject({
      providerFallbackUsed: true,
      providerTimedOut: true,
      providerError: 'The reparse provider timed out.',
    });
    expect(decideJdParseGate({
      review: mergedSecondReview,
      attempt: 2,
      maxReparseAttempts: 1,
    })).toMatchObject({
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_provider_failure',
    });
  });

  it('does not reparse a valid revise review without high-severity evidence', () => {
    expect(decideJdParseGate({
      review: { ...completeLowReview, reviewContractValid: true },
      attempt: 1,
      maxReparseAttempts: 1,
    })).toMatchObject({
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_insufficient_high_severity_evidence',
    });
  });

  it('does not reparse again after the single allowed reparse attempt', () => {
    expect(decideJdParseGate({
      review: { ...completeHighReview, reviewContractValid: true },
      attempt: 2,
      maxReparseAttempts: 1,
    })).toMatchObject({
      shouldReparse: false,
      blockMatch: true,
      finalStatus: 'needs_review_after_reparse',
    });
  });

  it('clamps the safeguard reparse environment setting to one', () => {
    process.env.AGENTIC_SAFEGUARD_MAX_REPARSE_ATTEMPTS = '9';
    expect(getMaxSafeguardReparseAttempts()).toBe(1);
  });
});
