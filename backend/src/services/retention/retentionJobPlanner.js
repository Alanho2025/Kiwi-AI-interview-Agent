const JOB_PRIORITY = Object.freeze({ session: 0, file: 1, benchmark: 2, mongo_document: 3 });

const assertNoGlobalKnowledge = (manifest) => {
  const mongoGlobal = (manifest.mongo || []).some((candidate) => (
    candidate.collection === 'documentchunks' && !candidate.sessionId
  ));
  const postgresGlobal = (manifest.postgres || []).some((candidate) => (
    candidate.table === 'document_chunks' && !candidate.sessionId
  ));
  if (mongoGlobal || postgresGlobal) {
    throw new Error('Global knowledge cannot be scheduled for retention cleanup');
  }
};

const resolveMongoResource = (candidate) => {
  if (candidate.sessionId) return { resourceType: 'session', resourceId: candidate.sessionId };
  if (candidate.fileId) return { resourceType: 'file', resourceId: candidate.fileId };
  if (candidate.caseId) return { resourceType: 'benchmark', resourceId: candidate.caseId };
  return { resourceType: 'mongo_document', resourceId: `${candidate.collection}:${candidate.id}` };
};

const resolvePostgresResource = (candidate) => {
  if (candidate.table === 'interview_sessions') {
    return { resourceType: 'session', resourceId: candidate.id };
  }
  if (candidate.table === 'uploaded_files') {
    return { resourceType: 'file', resourceId: candidate.id };
  }
  return { resourceType: 'postgres_row', resourceId: `${candidate.table}:${candidate.id}` };
};

const getOrCreateJob = (jobsByKey, resource) => {
  const key = `${resource.resourceType}:${resource.resourceId}`;
  if (!jobsByKey.has(key)) {
    jobsByKey.set(key, {
      ...resource,
      candidateManifest: { mongo: [], postgres: [] },
      filePaths: [],
    });
  }
  return jobsByKey.get(key);
};

export const buildRetentionJobs = (manifest = {}) => {
  assertNoGlobalKnowledge(manifest);
  const jobsByKey = new Map();
  for (const candidate of manifest.mongo || []) {
    getOrCreateJob(jobsByKey, resolveMongoResource(candidate))
      .candidateManifest.mongo.push(candidate);
  }
  for (const candidate of manifest.postgres || []) {
    getOrCreateJob(jobsByKey, resolvePostgresResource(candidate))
      .candidateManifest.postgres.push(candidate);
  }
  for (const job of jobsByKey.values()) {
    job.filePaths = manifest.filePathsByResourceId?.[job.resourceId] || [];
  }
  return [...jobsByKey.values()].sort((left, right) => {
    const priority = (JOB_PRIORITY[left.resourceType] ?? 99) - (JOB_PRIORITY[right.resourceType] ?? 99);
    return priority || left.resourceId.localeCompare(right.resourceId);
  });
};
