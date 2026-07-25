import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  compare: vi.fn(),
  cacheRead: vi.fn(),
  cacheWrite: vi.fn(),
  cacheWarm: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../../src/services/matchService.js', () => ({
  compareCvToJobDescription: mocks.compare,
}));

vi.mock('../../../src/services/agenticSafeguards/safeguardShared.js', () => ({
  shouldRunAgenticSafeguard: () => false,
  buildSkippedSafeguardResult: () => ({ verdict: 'skipped' }),
  getMaxSafeguardReparseAttempts: () => 1,
}));

vi.mock('../../../src/services/match/matchCriticAgent.js', () => ({
  reviewMatchWithDeepSeek: vi.fn(),
}));

vi.mock('../../../src/services/match/matchArtifactCacheService.js', () => ({
  buildMatchArtifactCacheIdentity: () => ({
    cacheKey: 'cache-key',
    cvHash: 'cv-hash',
    jdHash: 'jd-hash',
    settingsHash: 'settings-hash',
  }),
  readMatchArtifactCache: mocks.cacheRead,
  writeMatchArtifactCache: mocks.cacheWrite,
  warmReusableArtifactCaches: mocks.cacheWarm,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    warn: mocks.loggerWarn,
  },
}));

import { compareCvToJobDescriptionWithSafeguard } from '../../../src/services/match/guardedMatchService.js';

const reviewedRubric = {
  roleFit: {
    companyContext: { status: 'ready' },
    review: { status: 'verified' },
  },
};

describe('guarded Match critical path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cacheRead.mockResolvedValue(null);
    mocks.cacheWrite.mockResolvedValue(true);
    mocks.compare.mockResolvedValue({
      matchScore: 82,
      matchingDetails: {},
    });
  });

  it('returns the quality-checked Match without waiting for reusable cache warming', async () => {
    mocks.cacheWarm.mockImplementation(() => new Promise(() => {}));

    const result = await Promise.race([
      compareCvToJobDescriptionWithSafeguard(
        { userId: 'user-1', cvProfile: { candidateName: 'Candidate' } },
        'Reviewed job description',
        reviewedRubric,
        { userId: 'user-1' },
      ),
      new Promise((resolve) => setTimeout(() => resolve('timed-out'), 50)),
    ]);

    expect(result).toEqual(expect.objectContaining({
      matchScore: 82,
      safeguard: expect.objectContaining({ verdict: 'skipped' }),
    }));
    expect(mocks.cacheWrite).toHaveBeenCalledTimes(1);
    expect(mocks.cacheWarm).toHaveBeenCalledTimes(1);
  });

  it('still waits for the canonical Match cache write before returning', async () => {
    let finishCacheWrite;
    mocks.cacheWrite.mockImplementation(() => new Promise((resolve) => {
      finishCacheWrite = resolve;
    }));
    mocks.cacheWarm.mockResolvedValue(undefined);

    const matchPromise = compareCvToJobDescriptionWithSafeguard(
      { userId: 'user-1', cvProfile: { candidateName: 'Candidate' } },
      'Reviewed job description',
      reviewedRubric,
      { userId: 'user-1' },
    );
    const earlyResult = await Promise.race([
      matchPromise,
      new Promise((resolve) => setTimeout(() => resolve('still-writing'), 20)),
    ]);

    expect(earlyResult).toBe('still-writing');
    finishCacheWrite(true);
    await expect(matchPromise).resolves.toEqual(expect.objectContaining({ matchScore: 82 }));
  });
});
