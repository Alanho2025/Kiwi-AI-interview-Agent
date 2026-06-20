import { withTransaction } from '../db/postgres.js';

const SUPPORTED_TABLES = new Set(['interview_sessions', 'uploaded_files']);

const normalizeTimestamp = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const deleteSessionChildren = async (client, sessionId) => {
  await client.query(
    `UPDATE audit_logs
     SET session_id = NULL, ip_address = NULL, user_agent = NULL, metadata = '{}'::jsonb
     WHERE session_id = $1`,
    [sessionId],
  );
  await client.query('DELETE FROM report_summaries WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM interview_responses WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM interview_questions WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM parsed_skills WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM parsed_profiles WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM job_description_inputs WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM document_chunks WHERE session_id = $1', [sessionId]);
  await client.query('DELETE FROM uploaded_files WHERE session_id = $1', [sessionId]);
};

const deleteSessionCandidate = async (client, candidate) => {
  const result = await client.query(
    'SELECT id, updated_at FROM interview_sessions WHERE id = $1 FOR UPDATE',
    [candidate.id],
  );
  const current = result.rows[0];
  if (!current || normalizeTimestamp(current.updated_at) !== normalizeTimestamp(candidate.updatedAt)) {
    return false;
  }
  await deleteSessionChildren(client, candidate.id);
  const deleted = await client.query('DELETE FROM interview_sessions WHERE id = $1', [candidate.id]);
  return deleted.rowCount === 1;
};

const deleteUploadedFileCandidate = async (client, candidate) => {
  const result = await client.query(
    'SELECT id, updated_at FROM uploaded_files WHERE id = $1 AND deleted_at IS NULL FOR UPDATE',
    [candidate.id],
  );
  const current = result.rows[0];
  if (!current || normalizeTimestamp(current.updated_at) !== normalizeTimestamp(candidate.updatedAt)) {
    return false;
  }
  const references = await client.query(
    `SELECT COUNT(*)::bigint AS count
     FROM interview_sessions
     WHERE cv_file_id = $1`,
    [candidate.id],
  );
  if (Number(references.rows[0]?.count || 0) > 0) return false;
  const deleted = await client.query('DELETE FROM uploaded_files WHERE id = $1', [candidate.id]);
  return deleted.rowCount === 1;
};

const deleteCandidate = async (client, candidate) => {
  if (candidate.table === 'interview_sessions') {
    return deleteSessionCandidate(client, candidate);
  }
  return deleteUploadedFileCandidate(client, candidate);
};

export const createPostgresRetentionRepository = ({ runInTransaction = withTransaction } = {}) => ({
  deleteCandidatesInTransaction: async ({ candidates = [] } = {}) => {
    const unsupported = candidates.find((candidate) => !SUPPORTED_TABLES.has(candidate.table));
    if (unsupported) {
      throw new Error(`Unsupported PostgreSQL retention table: ${unsupported.table}`);
    }
    if (!candidates.length) return { deletedCount: 0, skippedCount: 0 };

    return runInTransaction(async (client) => {
      let deletedCount = 0;
      for (const candidate of candidates) {
        if (await deleteCandidate(client, candidate)) deletedCount += 1;
      }
      return { deletedCount, skippedCount: candidates.length - deletedCount };
    });
  },
});
