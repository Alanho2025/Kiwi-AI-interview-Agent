import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() }));

vi.mock('../../../src/db/models/companyValuesProfileModel.js', () => ({
  CompanyValuesProfile: {
    find: mocks.find,
    findOne: mocks.findOne,
    findOneAndUpdate: mocks.findOneAndUpdate,
  },
}));

import {
  confirmCompanyRoleFitReview,
  assertVerifiedCompanyRoleFitReview,
  getCompanyValuesProfilesByUserId,
  saveCompanyRoleFitDraft,
} from '../../../src/services/company/companyValuesRepository.js';

const leanResult = (value) => ({ lean: vi.fn(async () => value) });

describe('role-fit review repository robustness', () => {
  beforeEach(() => {
    mocks.find.mockReset();
    mocks.findOneAndUpdate.mockReset();
    mocks.findOne.mockReset();
  });

  it('lists only the owner records updated inside the seven-day retention window', async () => {
    const lean = vi.fn(async () => [{ jdFingerprint: 'recent-jd' }]);
    const sort = vi.fn(() => ({ lean }));
    mocks.find.mockReturnValue({ sort });
    const now = new Date('2026-07-30T12:00:00.000Z');

    await expect(getCompanyValuesProfilesByUserId('user-1', now)).resolves.toEqual([
      { jdFingerprint: 'recent-jd' },
    ]);

    expect(mocks.find).toHaveBeenCalledWith({
      userId: 'user-1',
      deletedAt: null,
      updatedAt: { $gt: new Date('2026-07-23T12:00:00.000Z') },
    });
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
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
          retentionUntil: expect.any(Date),
          containsSensitiveData: true,
          accessScope: 'private',
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
      roleFitProfile: {
        id: 'role-fit-1',
        review: { status: 'verified', baseVersion: 3, version: 4 },
        companyUnderstanding: {
          facts: [{ statement: 'Builds analytics products.', sourceConfidence: 'medium', reviewConfidence: 'unreviewed' }],
          businessModel: [{ statement: 'Builds analytics products.', sourceConfidence: 'medium', reviewConfidence: 'unreviewed' }],
          customersOrUsers: [{ statement: 'Serves energy teams.', sourceConfidence: 'medium', reviewConfidence: 'unreviewed' }],
          productsOrServices: [{ statement: 'Analytics dashboards.', sourceConfidence: 'medium', reviewConfidence: 'unreviewed' }],
          operatingContext: [{ statement: 'Manual reporting workflows.', sourceConfidence: 'medium', reviewConfidence: 'unreviewed' }],
          hiringContextHypotheses: [{ statement: 'May need this role to reduce manual workflow risk.', sourceConfidence: 'low', reviewConfidence: 'unreviewed' }],
        },
        roleIntent: {
          items: [{ statement: 'Production SQL', sourceConfidence: 'medium', reviewConfidence: 'unreviewed' }],
        },
      },
    });

    expect(mocks.findOneAndUpdate).toHaveBeenCalledWith(
      { userId: 'user-1', jdFingerprint: 'jd-fingerprint', roleFitReviewVersion: 3 },
      expect.objectContaining({
        $set: expect.objectContaining({
          roleFitReviewVersion: 4,
          roleFitReviewStatus: 'verified',
          roleFitProfile: expect.objectContaining({
            companyUnderstanding: expect.objectContaining({
              facts: [expect.objectContaining({
                sourceConfidence: 'medium',
                reviewConfidence: 'user_confirmed',
              })],
              businessModel: [expect.objectContaining({
                sourceConfidence: 'medium',
                reviewConfidence: 'user_confirmed',
              })],
              hiringContextHypotheses: [expect.objectContaining({
                sourceConfidence: 'low',
                reviewConfidence: 'user_confirmed',
              })],
            }),
            roleIntent: expect.objectContaining({
              items: [expect.objectContaining({
                sourceConfidence: 'medium',
                reviewConfidence: 'user_confirmed',
              })],
            }),
          }),
        }),
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
    expect(mocks.findOne).toHaveBeenCalledWith({
      userId: 'user-1',
      jdFingerprint: 'jd-fingerprint',
      deletedAt: null,
      updatedAt: { $gt: expect.any(Date) },
    });

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
