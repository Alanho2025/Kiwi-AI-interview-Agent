export const RETENTION_JOB_STATES = Object.freeze({
  PURGE_PENDING: 'purge_pending',
  FILES_QUARANTINED: 'files_quarantined',
  MONGO_COMMITTED: 'mongo_committed',
  POSTGRES_COMMITTED: 'postgres_committed',
  FILES_DELETED: 'files_deleted',
  COMPLETED: 'completed',
  MANUAL_REVIEW: 'manual_review',
});

const summarizeDryRun = (job) => ({
  jobId: job.id,
  state: job.state,
  dryRun: true,
  fileCount: job.filePaths?.length || 0,
  mongoCandidateCount: job.candidateManifest?.mongo?.length || 0,
  postgresCandidateCount: job.candidateManifest?.postgres?.length || 0,
});

export const createRetentionSagaService = ({
  jobRepository,
  mongoRepository,
  postgresRepository,
  fileQuarantine,
}) => {
  const execute = async ({ jobId, dryRun = false }) => {
    let job = await jobRepository.getById(jobId);
    if (!job) throw new Error(`Retention cleanup job not found: ${jobId}`);
    if (dryRun) return summarizeDryRun(job);
    if (job.state === RETENTION_JOB_STATES.COMPLETED) return job;

    try {
      if (job.state === RETENTION_JOB_STATES.PURGE_PENDING) {
        const quarantinedFiles = await fileQuarantine.quarantine({
          jobId: job.id,
          filePaths: job.filePaths || [],
        });
        job = await jobRepository.updateState({
          jobId: job.id,
          state: RETENTION_JOB_STATES.FILES_QUARANTINED,
          patch: { quarantinedFiles },
        });
      }

      if (job.state === RETENTION_JOB_STATES.FILES_QUARANTINED) {
        const mongoResult = await mongoRepository.deleteCandidatesInTransaction({
          candidates: job.candidateManifest?.mongo || [],
        });
        job = await jobRepository.updateState({
          jobId: job.id,
          state: RETENTION_JOB_STATES.MONGO_COMMITTED,
          patch: { mongoResult },
        });
      }

      if (job.state === RETENTION_JOB_STATES.MONGO_COMMITTED) {
        const postgresResult = await postgresRepository.deleteCandidatesInTransaction({
          candidates: job.candidateManifest?.postgres || [],
        });
        job = await jobRepository.updateState({
          jobId: job.id,
          state: RETENTION_JOB_STATES.POSTGRES_COMMITTED,
          patch: { postgresResult },
        });
      }

      if (job.state === RETENTION_JOB_STATES.POSTGRES_COMMITTED) {
        const fileResult = await fileQuarantine.finalize({ entries: job.quarantinedFiles || [] });
        job = await jobRepository.updateState({
          jobId: job.id,
          state: RETENTION_JOB_STATES.FILES_DELETED,
          patch: { fileResult },
        });
      }

      if (job.state === RETENTION_JOB_STATES.FILES_DELETED) {
        job = await jobRepository.updateState({
          jobId: job.id,
          state: RETENTION_JOB_STATES.COMPLETED,
        });
      }
      return job;
    } catch (error) {
      const failureState = error.code === 'ROLLBACK_FAILURE'
        ? RETENTION_JOB_STATES.MANUAL_REVIEW
        : job.state;
      await jobRepository.recordFailure({ jobId: job.id, state: failureState, error });
      throw error;
    }
  };

  return { execute };
};
