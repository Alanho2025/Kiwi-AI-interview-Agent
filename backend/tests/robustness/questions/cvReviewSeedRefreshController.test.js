import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveUserFromRequest: vi.fn(),
  saveReviewedCvProfile: vi.fn(),
  generateCvQuestionSeeds: vi.fn(),
  createAuditLog: vi.fn(),
  touchCvRetention: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../../src/services/authService.js', () => ({
  resolveUserFromRequest: mocks.resolveUserFromRequest,
}));

vi.mock('../../../src/services/cv/cvReviewedProfileService.js', () => ({
  saveReviewedCvProfile: mocks.saveReviewedCvProfile,
}));

vi.mock('../../../src/services/questions/cvQuestionSeedService.js', () => ({
  generateCvQuestionSeeds: mocks.generateCvQuestionSeeds,
}));

vi.mock('../../../src/services/auditService.js', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('../../../src/services/fileRepositoryService.js', () => ({
  attachDocumentContent: vi.fn(),
  createUploadedFileRecord: vi.fn(),
  getCvRecordById: vi.fn(),
  getRecentCvRecords: vi.fn(),
  touchCvRetention: mocks.touchCvRetention,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: mocks.loggerWarn,
  },
  getRequestLogMeta: (_req, metadata = {}) => metadata,
}));

const { reviewCvProfile } = await import('../../../src/controllers/uploadController.js');

const buildReq = () => ({
  params: { cvId: 'cv-1' },
  body: {
    reviewProfile: {
      candidateSummary: 'Reviewed candidate summary',
      coreSkills: ['React', 'Node.js'],
    },
  },
  ip: '127.0.0.1',
  get: vi.fn(() => 'vitest'),
});

describe('CV review seed refresh controller flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveUserFromRequest.mockResolvedValue({ id: 'user-1' });
    mocks.saveReviewedCvProfile.mockResolvedValue({
      id: 'cv-1',
      profile: {
        summary: 'Reviewed candidate summary',
        skills: [{ label: 'React' }],
        metadata: { inputTrustLevel: 'human_reviewed' },
      },
    });
    mocks.generateCvQuestionSeeds.mockResolvedValue([]);
    mocks.createAuditLog.mockResolvedValue({});
    mocks.touchCvRetention.mockResolvedValue([]);
  });

  it('regenerates CV question seeds from the saved reviewed profile', async () => {
    const req = buildReq();
    const res = { json: vi.fn() };
    const next = vi.fn();

    await reviewCvProfile(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.saveReviewedCvProfile).toHaveBeenCalledWith({
      cvId: 'cv-1',
      userId: 'user-1',
      reviewProfile: req.body.reviewProfile,
    });
    expect(mocks.generateCvQuestionSeeds).toHaveBeenCalledWith({
      userId: 'user-1',
      cvFileId: 'cv-1',
      cvProfile: expect.objectContaining({
        summary: 'Reviewed candidate summary',
        metadata: { inputTrustLevel: 'human_reviewed' },
      }),
    });
    expect(mocks.createAuditLog).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'CV profile reviewed successfully',
    }));
  });

  it('still saves the reviewed CV when seed refresh fails', async () => {
    const req = buildReq();
    const res = { json: vi.fn() };
    const next = vi.fn();
    mocks.generateCvQuestionSeeds.mockRejectedValue(new Error('seed write failed'));

    await reviewCvProfile(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'CV question seed generation failed',
      expect.objectContaining({
        userId: 'user-1',
        cvFileId: 'cv-1',
        action: 'review_cv_profile',
        error: 'seed write failed',
      })
    );
    expect(mocks.createAuditLog).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      message: 'CV profile reviewed successfully',
    }));
  });
});
