import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RETENTION_JOB_STATES,
  createRetentionSagaService,
} from '../../../src/services/retention/retentionSagaService.js';

const createHarness = (initialState = RETENTION_JOB_STATES.PURGE_PENDING) => {
  const job = {
    id: 'job-1',
    state: initialState,
    sessionId: 'session-1',
    candidateManifest: { mongo: [], postgres: [] },
    filePaths: ['/uploads/cv.pdf'],
    quarantinedFiles: [],
  };
  const jobRepository = {
    getById: vi.fn(async () => job),
    updateState: vi.fn(async ({ state, patch = {} }) => {
      Object.assign(job, patch, { state });
      return job;
    }),
    recordFailure: vi.fn(async ({ state, error }) => {
      job.state = state;
      job.lastError = error.message;
      return job;
    }),
  };
  const mongoRepository = { deleteCandidatesInTransaction: vi.fn(async () => ({ deletedCount: 3 })) };
  const postgresRepository = { deleteCandidatesInTransaction: vi.fn(async () => ({ deletedCount: 5 })) };
  const fileQuarantine = {
    quarantine: vi.fn(async () => [{ originalPath: '/uploads/cv.pdf', quarantinePath: '/trash/job-1/cv.pdf' }]),
    finalize: vi.fn(async () => ({ deletedCount: 1 })),
  };
  const service = createRetentionSagaService({
    jobRepository,
    mongoRepository,
    postgresRepository,
    fileQuarantine,
  });
  return { job, jobRepository, mongoRepository, postgresRepository, fileQuarantine, service };
};

describe('retentionSagaService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does not mutate any store during a dry run', async () => {
    const harness = createHarness();

    const result = await harness.service.execute({ jobId: 'job-1', dryRun: true });

    expect(result.dryRun).toBe(true);
    expect(harness.fileQuarantine.quarantine).not.toHaveBeenCalled();
    expect(harness.mongoRepository.deleteCandidatesInTransaction).not.toHaveBeenCalled();
    expect(harness.postgresRepository.deleteCandidatesInTransaction).not.toHaveBeenCalled();
    expect(harness.jobRepository.updateState).not.toHaveBeenCalled();
  });

  it('does not begin database deletion when file quarantine fails', async () => {
    const harness = createHarness();
    harness.fileQuarantine.quarantine.mockRejectedValue(new Error('quarantine failed'));

    await expect(harness.service.execute({ jobId: 'job-1' })).rejects.toThrow('quarantine failed');

    expect(harness.mongoRepository.deleteCandidatesInTransaction).not.toHaveBeenCalled();
    expect(harness.postgresRepository.deleteCandidatesInTransaction).not.toHaveBeenCalled();
    expect(harness.jobRepository.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      jobId: 'job-1',
      state: RETENTION_JOB_STATES.PURGE_PENDING,
    }));
  });

  it('keeps the mongo committed checkpoint when PostgreSQL deletion fails', async () => {
    const harness = createHarness(RETENTION_JOB_STATES.MONGO_COMMITTED);
    harness.postgresRepository.deleteCandidatesInTransaction.mockRejectedValueOnce(new Error('postgres failed'));

    await expect(harness.service.execute({ jobId: 'job-1' })).rejects.toThrow('postgres failed');

    expect(harness.job.state).toBe(RETENTION_JOB_STATES.MONGO_COMMITTED);
    expect(harness.fileQuarantine.finalize).not.toHaveBeenCalled();
    expect(harness.jobRepository.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      state: RETENTION_JOB_STATES.MONGO_COMMITTED,
    }));

    harness.postgresRepository.deleteCandidatesInTransaction.mockResolvedValueOnce({ deletedCount: 5 });
    await harness.service.execute({ jobId: 'job-1' });
    expect(harness.job.state).toBe(RETENTION_JOB_STATES.COMPLETED);
  });

  it('is idempotent when a completed job is executed again', async () => {
    const harness = createHarness(RETENTION_JOB_STATES.COMPLETED);

    const result = await harness.service.execute({ jobId: 'job-1' });

    expect(result.state).toBe(RETENTION_JOB_STATES.COMPLETED);
    expect(harness.fileQuarantine.quarantine).not.toHaveBeenCalled();
    expect(harness.mongoRepository.deleteCandidatesInTransaction).not.toHaveBeenCalled();
    expect(harness.postgresRepository.deleteCandidatesInTransaction).not.toHaveBeenCalled();
  });

  it('moves a job to manual review when rollback itself fails', async () => {
    const harness = createHarness(RETENTION_JOB_STATES.MONGO_COMMITTED);
    const error = Object.assign(new Error('rollback failed'), { code: 'ROLLBACK_FAILURE' });
    harness.postgresRepository.deleteCandidatesInTransaction.mockRejectedValue(error);

    await expect(harness.service.execute({ jobId: 'job-1' })).rejects.toThrow('rollback failed');

    expect(harness.jobRepository.recordFailure).toHaveBeenCalledWith(expect.objectContaining({
      state: RETENTION_JOB_STATES.MANUAL_REVIEW,
    }));
  });
});
