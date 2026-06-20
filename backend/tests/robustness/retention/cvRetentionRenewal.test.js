import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ postgresQuery: vi.fn(), updateDocument: vi.fn() }));

vi.mock('../../../src/db/postgres.js', () => ({ query: mocks.postgresQuery }));
vi.mock('../../../src/db/models/documentContentModel.js', () => ({
  DocumentContent: {
    updateOne: mocks.updateDocument,
  },
}));

const { touchCvRetention } = await import('../../../src/services/fileRepositoryService.js');

describe('CV retention renewal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.postgresQuery.mockResolvedValue({ rowCount: 1 });
    mocks.updateDocument.mockResolvedValue({ matchedCount: 1 });
  });

  it('renews PostgreSQL and Mongo timestamps together when a CV is used', async () => {
    await touchCvRetention('file-1', 'user-1');

    const postgresParams = mocks.postgresQuery.mock.calls[0][1];
    const mongoUpdate = mocks.updateDocument.mock.calls[0][1].$set;
    expect(postgresParams[2]).toEqual(mongoUpdate.updatedAt);
    expect(postgresParams[3]).toEqual(mongoUpdate.retentionUntil);
    expect(mongoUpdate.retentionUntil.getTime() - mongoUpdate.updatedAt.getTime())
      .toBe(7 * 24 * 60 * 60 * 1000);
  });
});
