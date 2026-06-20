import { describe, expect, it, vi } from 'vitest';
import { createRetentionExecutionService } from '../../../src/services/retention/retentionExecutionService.js';

const createHarness = ({ safeToExecute = true, backupVerified = true } = {}) => {
  const events = [];
  const jobs = Array.from({ length: 205 }, (_, index) => ({
    id: `job-${index}`,
    filePaths: index === 0 ? ['/uploads/cv.pdf'] : [],
  }));
  const dependencies = {
    runDryRun: vi.fn(async () => {
      events.push('dry-run');
      return { safeToExecute };
    }),
    loadCandidateManifest: vi.fn(async () => ({ runId: 'run-1', cutoff: '2026-06-12T00:00:00.000Z' })),
    backupService: {
      createAndVerify: vi.fn(async () => {
        events.push('backup');
        return { verified: backupVerified };
      }),
    },
    initializeSchema: vi.fn(async () => events.push('schema')),
    planJobs: vi.fn(() => jobs),
    jobRepository: {
      createJobs: vi.fn(async () => jobs),
    },
    sagaService: {
      execute: vi.fn(async ({ jobId }) => {
        events.push(jobId);
        return { id: jobId, state: 'completed' };
      }),
    },
    writeReport: vi.fn(async () => '/tmp/execution-report.json'),
  };
  return { dependencies, events, jobs };
};

describe('retentionExecutionService', () => {
  it('refuses execution unless the approval token exactly matches the reviewed run ID', async () => {
    const { dependencies } = createHarness();
    const service = createRetentionExecutionService(dependencies);

    await expect(service.execute({ runId: 'run-1', approvalToken: 'another-run' }))
      .rejects.toThrow('approval token');
    expect(dependencies.runDryRun).not.toHaveBeenCalled();
  });

  it('stops before backup or mutation when the immediate dry-run is unsafe', async () => {
    const { dependencies } = createHarness({ safeToExecute: false });
    const service = createRetentionExecutionService(dependencies);

    await expect(service.execute({ runId: 'run-1', approvalToken: 'run-1' }))
      .rejects.toThrow('dry-run');
    expect(dependencies.backupService.createAndVerify).not.toHaveBeenCalled();
    expect(dependencies.initializeSchema).not.toHaveBeenCalled();
  });

  it('verifies backup before schema mutation and executes no-file jobs first in batches of 100', async () => {
    const { dependencies, events, jobs } = createHarness();
    const service = createRetentionExecutionService(dependencies);

    const result = await service.execute({
      runId: 'run-1',
      approvalToken: 'run-1',
      mongoUri: 'mongodb://secret',
      postgresUrl: 'postgresql://secret',
    });

    expect(events.slice(0, 3)).toEqual(['dry-run', 'backup', 'schema']);
    expect(events[3]).toBe('job-1');
    expect(events.at(-1)).toBe('job-0');
    expect(dependencies.sagaService.execute).toHaveBeenCalledTimes(jobs.length);
    expect(result).toMatchObject({ completedJobCount: 205, batchCount: 3 });
  });

  it('stops before schema or deletion if backup verification is false', async () => {
    const { dependencies } = createHarness({ backupVerified: false });
    const service = createRetentionExecutionService(dependencies);

    await expect(service.execute({ runId: 'run-1', approvalToken: 'run-1' }))
      .rejects.toThrow('backup verification');
    expect(dependencies.initializeSchema).not.toHaveBeenCalled();
    expect(dependencies.sagaService.execute).not.toHaveBeenCalled();
  });
});
