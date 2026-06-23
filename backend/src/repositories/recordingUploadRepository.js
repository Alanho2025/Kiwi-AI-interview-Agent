import { query } from '../db/postgres.js';

const firstRow = (result) => result?.rows?.[0] || null;

export const createRecordingUploadRepository = ({ queryFn = query } = {}) => {
  const findOwnedBySession = async ({ sessionId, userId }) => firstRow(await queryFn(
    `SELECT * FROM recording_uploads
     WHERE session_id = $1 AND user_id = $2
     LIMIT 1`,
    [sessionId, userId],
  ));

  const findOwnedById = async ({ uploadId, userId }) => firstRow(await queryFn(
    `SELECT * FROM recording_uploads
     WHERE id = $1 AND user_id = $2
     LIMIT 1`,
    [uploadId, userId],
  ));

  const findOrCreateActive = async ({ sessionId, userId, mimeType }) => {
    const existing = await findOwnedBySession({ sessionId, userId });
    if (existing) return existing;

    return firstRow(await queryFn(
      `INSERT INTO recording_uploads (session_id, user_id, status, mime_type)
       VALUES ($1, $2, 'receiving', $3)
       ON CONFLICT (session_id) DO UPDATE SET updated_at = now()
       RETURNING *`,
      [sessionId, userId, mimeType],
    ));
  };

  const insertChunk = async ({ uploadId, sequence, checksum, byteLength, storageKey }) => {
    const inserted = firstRow(await queryFn(
      `INSERT INTO recording_upload_chunks (upload_id, sequence, checksum, byte_length, storage_key)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (upload_id, sequence) DO NOTHING
       RETURNING *`,
      [uploadId, sequence, checksum, byteLength, storageKey],
    ));
    if (inserted) return { inserted: true, chunk: inserted };

    const existing = firstRow(await queryFn(
      `SELECT * FROM recording_upload_chunks
       WHERE upload_id = $1 AND sequence = $2
       LIMIT 1`,
      [uploadId, sequence],
    ));
    return { inserted: false, existing };
  };

  const findChunk = async ({ uploadId, sequence }) => firstRow(await queryFn(
    `SELECT * FROM recording_upload_chunks
     WHERE upload_id = $1 AND sequence = $2
     LIMIT 1`,
    [uploadId, sequence],
  ));

  const refreshCounters = async (uploadId) => firstRow(await queryFn(
    `UPDATE recording_uploads upload
     SET received_chunks = aggregate.chunk_count,
         received_bytes = aggregate.byte_count,
         updated_at = now()
     FROM (
       SELECT COUNT(*)::integer AS chunk_count, COALESCE(SUM(byte_length), 0)::bigint AS byte_count
       FROM recording_upload_chunks WHERE upload_id = $1
     ) aggregate
     WHERE upload.id = $1
     RETURNING upload.*`,
    [uploadId],
  ));

  const listChunks = async (uploadId) => (await queryFn(
    `SELECT * FROM recording_upload_chunks
     WHERE upload_id = $1 ORDER BY sequence ASC`,
    [uploadId],
  )).rows || [];

  const finalizeManifest = async ({ uploadId, totalChunks, totalBytes }) => firstRow(await queryFn(
    `UPDATE recording_uploads
     SET total_chunks = $2,
         total_bytes = $3,
         finalized_at = COALESCE(finalized_at, now()),
         status = 'queued',
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [uploadId, totalChunks, totalBytes],
  ));

  const claimReadyJob = async ({ workerId, leaseMs }) => firstRow(await queryFn(
    `WITH candidate AS (
       SELECT id FROM recording_uploads
       WHERE status IN ('queued', 'recoverable_failed')
          OR (status = 'processing' AND lease_expires_at < now())
       ORDER BY updated_at ASC
       FOR UPDATE SKIP LOCKED
       LIMIT 1
     )
     UPDATE recording_uploads upload
     SET status = 'processing',
         lease_owner = $1,
         lease_expires_at = now() + ($2 * interval '1 millisecond'),
         processing_attempts = processing_attempts + 1,
         updated_at = now()
     FROM candidate
     WHERE upload.id = candidate.id
     RETURNING upload.*`,
    [workerId, leaseMs],
  ));

  const markReady = async ({ uploadId, storageKey }) => firstRow(await queryFn(
    `UPDATE recording_uploads
     SET status = 'ready', mp3_storage_key = $2,
         lease_owner = NULL, lease_expires_at = NULL,
         last_error_code = NULL, last_error_message = NULL, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [uploadId, storageKey],
  ));

  const markFailed = async ({ uploadId, status, code, message }) => firstRow(await queryFn(
    `UPDATE recording_uploads
     SET status = $2, last_error_code = $3, last_error_message = $4,
         lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
     WHERE id = $1 RETURNING *`,
    [uploadId, status, code, message],
  ));

  const queueRetry = async (uploadId) => firstRow(await queryFn(
    `UPDATE recording_uploads
     SET status = 'queued', lease_owner = NULL, lease_expires_at = NULL, updated_at = now()
     WHERE id = $1 AND status = 'recoverable_failed'
     RETURNING *`,
    [uploadId],
  ));

  return {
    findOwnedById,
    findOwnedBySession,
    findOrCreateActive,
    findChunk,
    insertChunk,
    refreshCounters,
    listChunks,
    finalizeManifest,
    claimReadyJob,
    markReady,
    markFailed,
    queueRetry,
  };
};

export const recordingUploadRepository = createRecordingUploadRepository();
