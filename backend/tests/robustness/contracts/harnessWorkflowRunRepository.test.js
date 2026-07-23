import { describe, expect, it, vi } from 'vitest';

import { createHarnessWorkflowRunRepository } from '../../../src/repositories/harnessWorkflowRunRepository.js';

const createLeanQuery = (result) => ({
  sort: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  lean: vi.fn().mockResolvedValue(result),
});

describe('M1 harness WorkflowRun repository', () => {
  it('upserts by workflowRunId and never overwrites an existing canonical run', async () => {
    const model = {
      findOneAndUpdate: vi.fn().mockResolvedValue({ workflowRunId: 'run-1' }),
    };
    const repository = createHarnessWorkflowRunRepository({ model });
    const run = { workflowRunId: 'run-1', idempotencyKey: 'idem-1' };

    await repository.appendCanonicalRun(run);

    expect(model.findOneAndUpdate).toHaveBeenCalledWith(
      { workflowRunId: 'run-1' },
      { $setOnInsert: run },
      expect.objectContaining({ upsert: true, new: true }),
    );
  });

  it('always scopes developer queries to the authenticated owner', async () => {
    const query = createLeanQuery([{ workflowRunId: 'run-owned' }]);
    const model = { find: vi.fn().mockReturnValue(query) };
    const repository = createHarnessWorkflowRunRepository({ model });

    const runs = await repository.findOwnedRuns({
      ownerUserId: 'owner-1',
      workflowRunId: 'run-owned',
      sessionId: 'session-owned',
      startedAfter: '2026-07-01T00:00:00.000Z',
      limit: 500,
    });

    expect(runs).toEqual([{ workflowRunId: 'run-owned' }]);
    expect(model.find).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'owner-1',
      workflowRunId: 'run-owned',
      sessionId: 'session-owned',
      startedAt: { $gte: new Date('2026-07-01T00:00:00.000Z') },
    }));
    expect(query.limit).toHaveBeenCalledWith(100);
  });

  it('rejects an unscoped query', async () => {
    const repository = createHarnessWorkflowRunRepository({ model: { find: vi.fn() } });

    await expect(repository.findOwnedRuns({ sessionId: 'session-owned' }))
      .rejects.toThrow('ownerUserId is required');
  });
});
