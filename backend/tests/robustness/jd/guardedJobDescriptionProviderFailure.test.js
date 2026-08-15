import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildStructuredJobDescriptionRubric: vi.fn(),
  validateJobDescriptionRubric: vi.fn(),
  reviewJdParseWithDeepSeek: vi.fn(),
  buildJdReparseOverridesWithDeepSeek: vi.fn(),
  memoryCache: {
    generateKey: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock('../../../src/services/jobDescription/jobDescriptionRubricBuilder.js', () => ({
  buildStructuredJobDescriptionRubric: mocks.buildStructuredJobDescriptionRubric,
}));

vi.mock('../../../src/services/jobDescription/jobDescriptionSchemaValidator.js', () => ({
  validateJobDescriptionRubric: mocks.validateJobDescriptionRubric,
}));

vi.mock('../../../src/services/jobDescription/jdParseCriticAgent.js', () => ({
  reviewJdParseWithDeepSeek: mocks.reviewJdParseWithDeepSeek,
}));

vi.mock('../../../src/services/jobDescription/jdParseReparseAgent.js', () => ({
  buildJdReparseOverridesWithDeepSeek: mocks.buildJdReparseOverridesWithDeepSeek,
}));

vi.mock('../../../src/utils/memoryCache.js', () => ({
  memoryCache: mocks.memoryCache,
}));

import { buildGuardedStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/guardedJobDescriptionService.js';

const previousEnv = { ...process.env };

const firstReview = {
  verdict: 'revise',
  issues: [{
    field: 'sections.responsibilities',
    severity: 'high',
    problem: 'Responsibilities need re-extraction.',
    action: 'Re-extract responsibilities from the original JD.',
  }],
  reviewContractValid: true,
  providerFallbackUsed: false,
  providerTimedOut: false,
  providerError: null,
};

const secondReview = {
  verdict: 'pass',
  issues: [],
  reviewContractValid: true,
  providerFallbackUsed: false,
  providerTimedOut: false,
  providerError: null,
};

describe('guarded JD provider failure orchestration', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env = {
      ...previousEnv,
      ENABLE_AGENTIC_SAFEGUARDS: 'true',
      AGENTIC_SAFEGUARDS_ENABLED: 'true',
      AGENTIC_SAFEGUARD_MAX_REPARSE_ATTEMPTS: '1',
    };

    mocks.memoryCache.generateKey.mockReturnValue('jd-cache-key');
    mocks.memoryCache.get.mockReturnValue(null);
    mocks.validateJobDescriptionRubric.mockImplementation((rubric) => rubric);
    mocks.buildStructuredJobDescriptionRubric
      .mockResolvedValueOnce({ parser: 'first' })
      .mockResolvedValueOnce({ parser: 'second' });
    mocks.reviewJdParseWithDeepSeek
      .mockResolvedValueOnce(firstReview)
      .mockResolvedValueOnce(secondReview);
    mocks.buildJdReparseOverridesWithDeepSeek.mockResolvedValue({
      sections: {
        responsibilities: ['Build reliable systems.'],
        mustHaveRequirements: [],
        niceToHaveRequirements: [],
        benefits: [],
        qualifications: [],
      },
      metadata: {
        providerFallbackUsed: true,
        providerTimedOut: true,
        providerError: 'timeout',
      },
    });
  });

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it('propagates reparse provider failure through the real guarded orchestration', async () => {
    const result = await buildGuardedStructuredJobDescriptionRubric('Responsibilities: build reliable systems.');

    expect(mocks.buildStructuredJobDescriptionRubric).toHaveBeenCalledTimes(2);
    expect(mocks.reviewJdParseWithDeepSeek).toHaveBeenCalledTimes(2);
    expect(mocks.buildJdReparseOverridesWithDeepSeek).toHaveBeenCalledTimes(1);
    expect(result.safeguard).toMatchObject({
      providerFallbackUsed: true,
      providerTimedOut: true,
      providerError: 'timeout',
      finalStatus: 'needs_review_provider_failure',
      blockMatch: true,
      parseAttempts: 2,
    });
  });
});
