import { describe, expect, it, vi } from 'vitest';
import { createRetentionJobRepository } from '../../../src/repositories/retentionJobRepository.js';

describe('retentionJobRepository', () => {
  it('claims a batch with an advisory lock and FOR UPDATE SKIP LOCKED', async () => {
    const client = {
      query: vi.fn()
        .mockResolvedValueOnce({ rows: [{ acquired: true }] })
        .mockResolvedValueOnce({ rows: [] }),
    };
    const runInTransaction = vi.fn(async (callback) => callback(client));
    const repository = createRetentionJobRepository({ runInTransaction });

    await repository.listReadyJobs({ limit: 100 });

    expect(client.query.mock.calls[0][0]).toContain('pg_try_advisory_xact_lock');
    expect(client.query.mock.calls[1][0]).toContain('FOR UPDATE SKIP LOCKED');
    expect(client.query.mock.calls[1][0]).toContain('UPDATE retention_cleanup_jobs');
    expect(runInTransaction).toHaveBeenCalledTimes(1);
  });
});
