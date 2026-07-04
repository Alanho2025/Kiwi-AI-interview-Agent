import crypto from 'crypto';
import { query, withTransaction } from '../db/postgres.js';
import { RETENTION_JOB_STATES } from '../services/retention/retentionSagaService.js';

const JOB_PATCH_COLUMNS = Object.freeze({
  quarantinedFiles: 'quarantined_files',
  mongoResult: 'mongo_result',
  postgresResult: 'postgres_result',
  fileResult: 'file_result',
});

const mapJobRow = (row) => row ? ({
  id: row.id,
  runId: row.run_id,
  resourceType: row.resource_type,
  resourceId: row.resource_id,
  state: row.state,
  cutoffAt: row.cutoff_at,
  candidateManifest: row.candidate_manifest || {},
  filePaths: row.file_paths || [],
  quarantinedFiles: row.quarantined_files || [],
  mongoResult: row.mongo_result || null,
  postgresResult: row.postgres_result || null,
  fileResult: row.file_result || null,
  attemptCount: Number(row.attempt_count || 0),
  lastError: row.last_error || null,
  nextRetryAt: row.next_retry_at || null,
  completedAt: row.completed_at || null,
}) : null;

const buildStatePatch = (patch = {}) => Object.entries(patch)
  .filter(([key]) => JOB_PATCH_COLUMNS[key])
  .map(([key, value]) => ({ column: JOB_PATCH_COLUMNS[key], value }));

export const createRetentionJobRepository = ({ runQuery = query, runInTransaction = withTransaction } = {}) => {
  const getById = async (jobId) => {
    const result = await runQuery('SELECT * FROM retention_cleanup_jobs WHERE id = $1 LIMIT 1', [jobId]);
    return mapJobRow(result.rows[0]);
  };

  const updateState = async ({ jobId, state, patch = {} }) => {
    const statePatch = buildStatePatch(patch);
    const values = [state];
    const assignments = ['state = $1', 'updated_at = now()', 'last_error = NULL', 'next_retry_at = NULL'];
    for (const item of statePatch) {
      values.push(JSON.stringify(item.value));
      assignments.push(`${item.column} = $${values.length}::jsonb`);
    }
    if (state === RETENTION_JOB_STATES.COMPLETED) assignments.push('completed_at = now()');
    values.push(jobId);
    const result = await runQuery(
      `UPDATE retention_cleanup_jobs SET ${assignments.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return mapJobRow(result.rows[0]);
  };

  const recordFailure = async ({ jobId, state, error }) => {
    const message = String(error?.message || 'Unknown retention cleanup failure').slice(0, 2000);
    const result = await runQuery(
      `UPDATE retention_cleanup_jobs
       SET state = $2,
           attempt_count = attempt_count + 1,
           last_error = $3,
           next_retry_at = now() + LEAST(interval '6 hours', interval '1 minute' * POWER(2, LEAST(attempt_count, 8))),
           updated_at = now()
       WHERE id = $1
       RETURNING *`,
      [jobId, state, message],
    );
    return mapJobRow(result.rows[0]);
  };

  const createJobs = async ({ runId, cutoffAt, jobs = [] }) => runInTransaction(async (client) => {
    const created = [];
    for (const job of jobs) {
      const result = await client.query(
        `INSERT INTO retention_cleanup_jobs (
          id, run_id, resource_type, resource_id, state, cutoff_at,
          candidate_manifest, file_paths, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,now(),now())
        ON CONFLICT (run_id, resource_type, resource_id) DO UPDATE SET
          candidate_manifest = EXCLUDED.candidate_manifest,
          file_paths = EXCLUDED.file_paths,
          updated_at = now()
        RETURNING *`,
        [
          crypto.randomUUID(),
          runId,
          job.resourceType,
          job.resourceId,
          RETENTION_JOB_STATES.PURGE_PENDING,
          cutoffAt,
          JSON.stringify(job.candidateManifest || {}),
          JSON.stringify(job.filePaths || []),
        ],
      );
      created.push(mapJobRow(result.rows[0]));
    }
    return created;
  });

  const listReadyJobs = async ({ limit = 100 } = {}) => runInTransaction(async (client) => {
    const lock = await client.query(
      `SELECT pg_try_advisory_xact_lock(
        hashtext('kiwi_retention_cleanup_worker')
      ) AS acquired`,
    );
    if (!lock.rows[0]?.acquired) return [];
    const result = await client.query(
      `WITH ready AS (
         SELECT id
         FROM retention_cleanup_jobs
         WHERE state NOT IN ($1, $2)
           AND (next_retry_at IS NULL OR next_retry_at <= now())
         ORDER BY created_at ASC
         LIMIT $3
         FOR UPDATE SKIP LOCKED
       )
       UPDATE retention_cleanup_jobs jobs
       SET next_retry_at = now() + interval '15 minutes',
           updated_at = now()
       FROM ready
       WHERE jobs.id = ready.id
       RETURNING jobs.*`,
      [RETENTION_JOB_STATES.COMPLETED, RETENTION_JOB_STATES.MANUAL_REVIEW, limit],
    );
    return result.rows.map(mapJobRow);
  });

  return { getById, updateState, recordFailure, createJobs, listReadyJobs };
};
