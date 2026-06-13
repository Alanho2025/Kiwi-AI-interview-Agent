import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  indexSessionArtifacts: vi.fn(),
  warn: vi.fn(),
}));

vi.mock('../../src/services/ragIndexService.js', () => ({
  indexSessionArtifacts: mocks.indexSessionArtifacts,
}));

vi.mock('../../src/utils/logger.js', () => ({
  logger: {
    warn: mocks.warn,
  },
}));

const { indexReportSessionArtifactsSafely } = await import('../../src/services/reportIndexingGuardService.js');

describe('report indexing guard service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns indexed record count when RAG indexing succeeds', async () => {
    mocks.indexSessionArtifacts.mockResolvedValue([{ chunkId: 'chunk-1' }, { chunkId: 'chunk-2' }]);

    const result = await indexReportSessionArtifactsSafely({ sessionId: 'session-1' });

    expect(result).toEqual({ ok: true, recordCount: 2 });
  });

  it('downgrades report generation instead of throwing when RAG indexing fails', async () => {
    mocks.indexSessionArtifacts.mockRejectedValue(new Error('pgvector unavailable'));

    const result = await indexReportSessionArtifactsSafely({ sessionId: 'session-1' });

    expect(result).toEqual({
      ok: false,
      recordCount: 0,
      error: 'pgvector unavailable',
    });
    expect(mocks.warn).toHaveBeenCalledWith(
      'Report generation continuing after RAG indexing failed',
      {
        sessionId: 'session-1',
        error: 'pgvector unavailable',
      }
    );
  });
});
