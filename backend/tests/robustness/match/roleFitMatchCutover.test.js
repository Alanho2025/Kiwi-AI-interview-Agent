import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  assertVerifiedReview: vi.fn(),
  compare: vi.fn(),
  getOwnedCv: vi.fn(),
}));

vi.mock('../../../src/services/company/companyValuesRepository.js', () => ({
  assertVerifiedCompanyRoleFitReview: mocks.assertVerifiedReview,
}));

vi.mock('../../../src/services/match/guardedMatchService.js', () => ({
  compareCvToJobDescriptionWithSafeguard: mocks.compare,
}));

vi.mock('../../../src/services/cv/cvOwnershipService.js', () => ({
  getOwnedCvDocumentOrThrow: mocks.getOwnedCv,
}));

import { runCvJdMatchAnalysis } from '../../../src/services/cv/cvAnalysisService.js';

describe('Role-Fit match cutover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getOwnedCv.mockResolvedValue({
      fileId: 'cv-1',
      normalizedText: 'Node.js API experience',
      cvProfile: { candidateName: 'Candidate', skills: [], evidenceProfile: {} },
      parseWarnings: [],
    });
    mocks.compare.mockResolvedValue({ sourceSnapshots: [], warnings: [] });
  });

  it('blocks new match requests that do not carry a verified Role-Fit artifact', async () => {
    await expect(runCvJdMatchAnalysis({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Backend engineer JD',
      jdRubric: { metadata: { humanReviewStatus: 'verified' } },
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
    });

    expect(mocks.getOwnedCv).not.toHaveBeenCalled();
    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it('uses the owner-scoped persisted review before invoking the matcher', async () => {
    const jdRubric = {
      roleFit: {
        id: 'role-fit-1',
        jdFingerprint: 'jd-fingerprint',
        review: { version: 3, status: 'verified' },
      },
    };

    await runCvJdMatchAnalysis({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Backend engineer JD',
      jdRubric,
    });

    expect(mocks.assertVerifiedReview).toHaveBeenCalledWith({
      userId: 'user-1',
      jdFingerprint: 'jd-fingerprint',
      reviewVersion: 3,
      roleFitProfileId: 'role-fit-1',
    });
    expect(mocks.getOwnedCv).toHaveBeenCalledWith({ cvId: 'cv-1', userId: 'user-1' });
    expect(mocks.compare).toHaveBeenCalled();
  });
});
