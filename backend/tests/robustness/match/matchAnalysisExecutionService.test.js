import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  runMatchExecution: vi.fn(),
  createRecord: vi.fn(),
  updateTrace: vi.fn(),
  buildQuestionFilter: vi.fn(),
  recordUsage: vi.fn(),
  loggerInfo: vi.fn(),
  loggerWarn: vi.fn(),
}));

vi.mock('../../../src/services/cv/cvAnalysisService.js', () => ({
  runCvJdMatchExecution: mocks.runMatchExecution,
}));

vi.mock('../../../src/services/cv/matchAnalysisRecordService.js', () => ({
  createMatchAnalysisRecord: mocks.createRecord,
  updateMatchAnalysisPerformanceTrace: mocks.updateTrace,
}));

vi.mock('../../../src/services/questions/jdQuestionFilterService.js', () => ({
  buildJdQuestionFilter: mocks.buildQuestionFilter,
}));

vi.mock('../../../src/services/aiUsageTrackingService.js', () => ({
  recordLocalUsage: mocks.recordUsage,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: {
    info: mocks.loggerInfo,
    warn: mocks.loggerWarn,
  },
}));

import { executeCanonicalMatch } from '../../../src/services/match/matchAnalysisExecutionService.js';

describe('canonical Match execution service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runMatchExecution.mockImplementation(async ({ performanceTrace }) => {
      await performanceTrace.measure('match_compare_first', async () => undefined);
      return {
        cvDocument: {
          fileId: 'cv-1',
          parseWarnings: [],
          cvProfile: { candidateName: 'Candidate' },
        },
        matchData: {
          matchScore: 78,
          parsedJdProfile: { metadata: { jdFingerprint: 'jd-1' } },
          strengths: [],
          gaps: [],
          warnings: [],
          cache: { hit: false },
          safeguard: { compareAttempts: 1 },
        },
      };
    });
    mocks.createRecord.mockResolvedValue({
      matchAnalysisId: 'match-1',
      evidenceRefs: [{ id: 'evidence-1' }],
    });
    mocks.buildQuestionFilter.mockResolvedValue({ id: 'filter-1' });
    mocks.recordUsage.mockResolvedValue(undefined);
    mocks.updateTrace.mockResolvedValue(undefined);
  });

  it('reuses the CV loaded by the canonical Match instead of reading it again', async () => {
    const result = await executeCanonicalMatch({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Reviewed job description',
      jdRubric: { roleFit: { id: 'role-fit-1' } },
      settings: {},
      requestId: 'request-1',
    });

    expect(mocks.createRecord).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1',
      cvFileId: 'cv-1',
      cvDocument: expect.objectContaining({ fileId: 'cv-1' }),
      matchData: expect.objectContaining({ matchScore: 78 }),
    }));
    expect(result).toEqual(expect.objectContaining({
      matchScore: 78,
      matchAnalysisId: 'match-1',
      evidenceRefs: [{ id: 'evidence-1' }],
      performanceTrace: expect.objectContaining({
        schemaVersion: 'match_performance_trace_v1',
        requestId: 'request-1',
      }),
    }));
  });

  it('reports real trace boundaries to the stream observer', async () => {
    const progressReporter = {
      observeTraceStep: vi.fn(),
    };

    await executeCanonicalMatch({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Reviewed job description',
      jdRubric: { roleFit: { id: 'role-fit-1' } },
      settings: {},
      requestId: 'request-2',
      progressReporter,
    });

    expect(progressReporter.observeTraceStep).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'started',
      step: 'match_compare_first',
    }));
    expect(progressReporter.observeTraceStep).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'completed',
      step: 'match_record_persist',
      ok: true,
    }));
    expect(progressReporter.observeTraceStep).toHaveBeenCalledWith(expect.objectContaining({
      phase: 'completed',
      step: 'jd_question_filter_build',
      ok: true,
    }));
  });

  it('preserves the completed Match when question-filter preparation degrades', async () => {
    mocks.buildQuestionFilter.mockRejectedValueOnce(new Error('question filter unavailable'));

    const result = await executeCanonicalMatch({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Reviewed job description',
      jdRubric: { roleFit: { id: 'role-fit-1' } },
      settings: {},
      requestId: 'request-3',
    });

    expect(result.matchAnalysisId).toBe('match-1');
    expect(result.performanceTrace.jdQuestionFilterStatus).toBe('failed');
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      'JD question filter generation failed',
      expect.objectContaining({
        userId: 'user-1',
        cvId: 'cv-1',
        matchAnalysisId: 'match-1',
      }),
    );
  });

  it('exposes persistence failure as a stable repairable Match error', async () => {
    mocks.createRecord.mockRejectedValueOnce(new Error('database write failed'));

    await expect(executeCanonicalMatch({
      cvId: 'cv-1',
      userId: 'user-1',
      rawJD: 'Reviewed job description',
      jdRubric: { roleFit: { id: 'role-fit-1' } },
      settings: {},
      requestId: 'request-4',
    })).rejects.toMatchObject({
      code: 'PERSISTENCE_FAILED',
      expose: true,
    });
  });
});
