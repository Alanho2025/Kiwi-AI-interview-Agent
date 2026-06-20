const DEFAULT_BATCH_SIZE = 100;

const prioritizeJobs = (jobs) => [...jobs].sort((left, right) => {
  const fileDifference = Number(Boolean(left.filePaths?.length)) - Number(Boolean(right.filePaths?.length));
  return fileDifference || String(left.id).localeCompare(String(right.id));
});

const splitIntoBatches = (items, batchSize) => {
  const batches = [];
  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }
  return batches;
};

export const createRetentionExecutionService = ({
  runDryRun,
  loadCandidateManifest,
  backupService,
  initializeSchema,
  planJobs,
  jobRepository,
  sagaService,
  writeReport,
  batchSize = DEFAULT_BATCH_SIZE,
}) => {
  const execute = async ({ runId, approvalToken, mongoUri, postgresUrl }) => {
    if (!runId || approvalToken !== runId) {
      throw new Error('Retention execution approval token must exactly match the reviewed run ID');
    }
    const dryRun = await runDryRun({ runId });
    if (!dryRun.safeToExecute) {
      throw new Error('Immediate retention dry-run is unsafe; execution stopped before mutation');
    }
    const candidateManifest = await loadCandidateManifest({ runId });
    if (candidateManifest.runId !== runId) {
      throw new Error('Encrypted candidate manifest does not match the approved run ID');
    }
    const backup = await backupService.createAndVerify({ runId, mongoUri, postgresUrl });
    if (!backup.verified) {
      throw new Error('Retention backup verification did not succeed');
    }
    await initializeSchema();
    const plannedJobs = planJobs(candidateManifest);
    const createdJobs = await jobRepository.createJobs({
      runId,
      cutoffAt: candidateManifest.cutoff,
      jobs: plannedJobs,
    });
    const batches = splitIntoBatches(prioritizeJobs(createdJobs), batchSize);
    const completedJobs = [];
    for (const batch of batches) {
      for (const job of batch) {
        const completed = await sagaService.execute({ jobId: job.id });
        if (completed.state !== 'completed') {
          throw new Error(`Retention job did not complete: ${job.id} (${completed.state})`);
        }
        completedJobs.push(completed);
      }
    }
    const execution = {
      runId,
      completedAt: new Date().toISOString(),
      backupVerificationPath: backup.verificationPath || null,
      plannedJobCount: plannedJobs.length,
      completedJobCount: completedJobs.length,
      batchCount: batches.length,
    };
    const reportPath = await writeReport(execution);
    return { ...execution, reportPath };
  };

  return { execute };
};
