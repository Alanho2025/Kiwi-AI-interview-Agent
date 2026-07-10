import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findOne: vi.fn(), findOneAndUpdate: vi.fn() }));

vi.mock('../../../src/db/models/companyValuesProfileModel.js', () => ({
  CompanyValuesProfile: { findOne: mocks.findOne, findOneAndUpdate: mocks.findOneAndUpdate },
}));

import {
  confirmCompanyRoleFitReview,
  assertVerifiedCompanyRoleFitReview,
  saveCompanyRoleFitDraft,
} from '../../../src/services/company/companyValuesRepository.js';

const leanResult = (value) => ({ lean: vi.fn(async () => value) });

describe('role-fit review repository robustness', () => {
  beforeEach(() => {
    mocks.findOneAndUpdate.mockReset();
    mocks.findOne.mockReset();
  });

  it('stores a role-fit draft under the owning user and JD fingerprint', async () => {
    mocks.findOneAndUpdate.mockReturnValue(leanResult({ roleFitReviewVersion: 1, roleFitReviewStatus: 'unreviewed' }));

    await saveCompanyRoleFitDraft({
      userId: 'user-1',
      jdFingerprint: 'jd-fingerprint',
      roleFitProfile: { id: 'role-fit-1', review: { status: 'unreviewed', version: 1 } },
    });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', jdFingerprint: 'jd-fingerprint' },
      expect.objectContaining({
        $set: expect.objectContaining({
          userId: 'user-1',
          jdFingerprint: 'jd-fingerprint',
          roleFitReviewVersion: 1,
          roleFitReviewStatus: 'unreviewed',
        }),
      }),
      expect.objectContaining({ upsert: true, new: true })
    );
  });

  it('confirms a review only when owner, fingerprint, and base version all match', async () => {
    mocks.findOneAndUpdate.mockReturnValue(leanResult({ roleFitReviewVersion: 4, roleFitReviewStatus: 'verified' }));

    const result = await confirmCompanyRoleFitReview({
      userId: 'user-1',
      jdFingerprint: 'jd-fingerprint',
      baseVersion: 3,
      roleFitProfile: { id: 'role-fit-1', review: { status: 'verified', baseVersion: 3, version: 4 } },
    });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', jdFingerprint: 'jd-fingerprint', roleFitReviewVersion: 3 },
      expect.objectContaining({
        $set: expect.objectContaining({ roleFitReviewVersion: 4, roleFitReviewStatus: 'verified' }),
      }),
      expect.objectContaining({ new: true })
    );
    expect(result.roleFitReviewVersion).toBe(4);
  });

  it('returns a 409 conflict for a stale or non-owned review version', async () => {
    mocks.findOneAndUpdate.mockReturnValue(leanResult(null));

    await expect(confirmCompanyRoleFitReview({
      userId: 'user-1',
      jdFingerprint: 'jd-fingerprint',
      baseVersion: 2,
      roleFitProfile: { review: { status: 'verified', baseVersion: 2, version: 3 } },
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('requires match requests to use the owner-scoped persisted verified version', async () => {
    mocks.findOne.mockReturnValueOnce(leanResult({
      roleFitReviewVersion: 4,
      roleFitReviewStatus: 'verified',
      roleFitProfile: { id: 'role-fit-1' },
    }));

    await expect(assertVerifiedCompanyRoleFitReview({
      userId: 'user-1',
      jdFingerprint: 'jd-fingerprint',
      reviewVersion: 4,
      roleFitProfileId: 'role-fit-1',
    })).resolves.toMatchObject({ roleFitReviewVersion: 4 });
    expect(mocks.findOne).toHaveBeenCalledWith({ userId: 'user-1', jdFingerprint: 'jd-fingerprint' });

    mocks.findOne.mockReturnValueOnce(leanResult({
      roleFitReviewVersion: 5,
      roleFitReviewStatus: 'verified',
      roleFitProfile: { id: 'role-fit-1' },
    }));
    await expect(assertVerifiedCompanyRoleFitReview({
      userId: 'user-1',
      jdFingerprint: 'jd-fingerprint',
      reviewVersion: 4,
      roleFitProfileId: 'role-fit-1',
    })).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });
});
