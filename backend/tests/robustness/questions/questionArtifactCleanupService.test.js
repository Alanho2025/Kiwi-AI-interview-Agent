import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  deletePoolItems: vi.fn(),
  postgresQuery: vi.fn(),
  deleteJdFilters: vi.fn(),
  deleteCvSeeds: vi.fn(),
}));

vi.mock('../../../src/db/models/interviewQuestionPoolItemModel.js', () => ({
  InterviewQuestionPoolItem: { deleteMany: mocks.deletePoolItems },
}));

vi.mock('../../../src/db/postgres.js', () => ({
  query: mocks.postgresQuery,
}));

vi.mock('../../../src/db/models/jdQuestionFilterModel.js', () => ({
  JdQuestionFilter: { deleteMany: mocks.deleteJdFilters },
}));

vi.mock('../../../src/db/models/cvQuestionSeedModel.js', () => ({
  CvQuestionSeed: { deleteMany: mocks.deleteCvSeeds },
}));

const { cleanupQuestionArtifactsAfterReport } = await import('../../../src/services/questions/questionArtifactCleanupService.js');

describe('questionArtifactCleanupService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.deletePoolItems.mockResolvedValue({ deletedCount: 3 });
    mocks.postgresQuery.mockResolvedValue({ rowCount: 4 });
    mocks.deleteJdFilters.mockResolvedValue({ deletedCount: 1 });
    mocks.deleteCvSeeds.mockResolvedValue({ deletedCount: 5 });
  });

  it('deletes prepared pool, JD filter, and CV seeds after report generation', async () => {
    const result = await cleanupQuestionArtifactsAfterReport({
      userId: 'user-1',
      sessionId: 'session-1',
      cvFileId: 'cv-1',
      matchAnalysisId: 'match-1',
    });

    expect(mocks.deletePoolItems).toHaveBeenCalledWith({ userId: 'user-1', sessionId: 'session-1' });
    expect(mocks.postgresQuery).toHaveBeenCalledWith(
      'DELETE FROM document_chunks WHERE session_id = $1 AND source_type = $2',
      ['session-1', 'prepared_question_pool']
    );
    expect(mocks.deleteJdFilters).toHaveBeenCalledWith({ userId: 'user-1', matchAnalysisId: 'match-1' });
    expect(mocks.deleteCvSeeds).toHaveBeenCalledWith({ userId: 'user-1', cvFileId: 'cv-1' });
    expect(result).toEqual({
      deletedPreparedPoolItems: 3,
      deletedPreparedPoolChunks: 4,
      deletedJdQuestionFilters: 1,
      deletedCvQuestionSeeds: 5,
    });
  });

  it('does not run broad deletes when optional identifiers are missing', async () => {
    const result = await cleanupQuestionArtifactsAfterReport({
      userId: 'user-1',
      sessionId: 'session-1',
    });

    expect(mocks.deletePoolItems).toHaveBeenCalledWith({ userId: 'user-1', sessionId: 'session-1' });
    expect(mocks.postgresQuery).toHaveBeenCalled();
    expect(mocks.deleteJdFilters).not.toHaveBeenCalled();
    expect(mocks.deleteCvSeeds).not.toHaveBeenCalled();
    expect(result).toEqual({
      deletedPreparedPoolItems: 3,
      deletedPreparedPoolChunks: 4,
      deletedJdQuestionFilters: 0,
      deletedCvQuestionSeeds: 0,
    });
  });

  it('returns zero counts when required ownership identifiers are missing', async () => {
    const result = await cleanupQuestionArtifactsAfterReport({ sessionId: 'session-1' });

    expect(mocks.deletePoolItems).not.toHaveBeenCalled();
    expect(mocks.postgresQuery).not.toHaveBeenCalled();
    expect(mocks.deleteJdFilters).not.toHaveBeenCalled();
    expect(mocks.deleteCvSeeds).not.toHaveBeenCalled();
    expect(result.deletedPreparedPoolItems).toBe(0);
  });
});
