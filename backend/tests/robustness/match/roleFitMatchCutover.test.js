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

import {
  runCvJdMatchAnalysis,
  runCvJdMatchExecution,
} from '../../../src/services/cv/cvAnalysisService.js';
import { createMatchPerformanceTrace } from '../../../src/services/match/matchPerformanceTraceService.js';

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

  it('records service-level performance trace steps for a verified match request', async () => {
    const jdRubric = {
      roleFit: {
        id: 'role-fit-1',
        jdFingerprint: 'jd-fingerprint',
        review: { version: 3, status: 'verified' },
      },
    };
    const performanceTrace = createMatchPerformanceTrace({ requestId: 'request-1', cvId: 'cv-1' });

    await runCvJdMatchAnalysis({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Backend engineer JD',
      jdRubric,
      performanceTrace,
    });

    expect(performanceTrace.toJSON().steps.map((step) => step.step)).toEqual(expect.arrayContaining([
      'role_fit_review_gate',
      'cv_document_load',
      'guarded_match_analysis',
    ]));
    expect(mocks.compare).toHaveBeenCalledWith(
      expect.any(Object),
      'Backend engineer JD',
      jdRubric,
      expect.objectContaining({ userId: 'user-1', cvId: 'cv-1' }),
      { performanceTrace },
    );
  });

  it('returns the already loaded owned CV for persistence reuse', async () => {
    const jdRubric = {
      roleFit: {
        id: 'role-fit-1',
        jdFingerprint: 'jd-fingerprint',
        review: { version: 3, status: 'verified' },
      },
    };

    const execution = await runCvJdMatchExecution({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Backend engineer JD',
      jdRubric,
    });

    expect(execution.cvDocument.fileId).toBe('cv-1');
    expect(execution.matchData).toEqual(expect.objectContaining({ sourceSnapshots: expect.any(Array) }));
    expect(mocks.getOwnedCv).toHaveBeenCalledTimes(1);
  });

  it('rejects corrupted owned CV text before invoking the matcher', async () => {
    mocks.getOwnedCv.mockResolvedValueOnce({
      fileId: 'cv-1',
      normalizedText: `Candidate experience ${'#'.repeat(25)} ${'delivery '.repeat(10)}`,
      cvProfile: { candidateName: 'Candidate', skills: [], evidenceProfile: {} },
      parseWarnings: [],
    });
    const jdRubric = {
      roleFit: {
        id: 'role-fit-1',
        jdFingerprint: 'jd-fingerprint',
        review: { version: 3, status: 'verified' },
      },
    };

    await expect(runCvJdMatchExecution({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Backend engineer JD with enough reviewed role context.',
      jdRubric,
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'CORRUPTED',
    });

    expect(mocks.compare).not.toHaveBeenCalled();
  });

  it('reports input and role-review progress around the real boundaries', async () => {
    const progressReporter = {
      stageStarted: vi.fn(),
      stageCompleted: vi.fn(),
    };
    const jdRubric = {
      roleFit: {
        id: 'role-fit-1',
        jdFingerprint: 'jd-fingerprint',
        review: { version: 3, status: 'verified' },
      },
    };

    await runCvJdMatchExecution({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Backend engineer JD',
      jdRubric,
      progressReporter,
    });

    expect(progressReporter.stageStarted.mock.calls).toEqual([
      ['input_validation'],
      ['role_fit_gate'],
    ]);
    expect(progressReporter.stageCompleted.mock.calls).toEqual([
      ['input_validation'],
      ['role_fit_gate'],
    ]);
  });
});
