/**
 * File responsibility: Repository / data access module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: fileRepository should centralise data access queries so schema changes touch the fewest files possible.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';
import { query } from '../db/postgres.js';

/**
 * Purpose: Execute the main responsibility for createUploadedFile.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const createUploadedFile = async ({
  userId,
  sessionId = null,
  fileRole,
  originalFilename,
  mimeType,
  storageProvider,
  storageKey,
  fileSizeBytes,
  checksum = null,
}) => {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO uploaded_files (
      id, user_id, session_id, file_role, original_filename, mime_type,
      storage_provider, storage_key, file_size_bytes, checksum,
      virus_scan_status, virus_scanned_at, uploaded_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'completed',now(),now())`,
    [id, userId, sessionId, fileRole, originalFilename, mimeType, storageProvider, storageKey, fileSizeBytes, checksum]
  );

  return id;
};

/**
 * Purpose: Execute the main responsibility for findRecentFilesByUserAndRole.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const findRecentFilesByUserAndRole = async ({ userId, fileRole, limit = 5 }) => {
  const result = await query(
    `SELECT *
     FROM uploaded_files
     WHERE user_id = $1 AND file_role = $2 AND deleted_at IS NULL
     ORDER BY uploaded_at DESC
     LIMIT $3`,
    [userId, fileRole, limit]
  );

  return result.rows;
};

/**
 * Purpose: Execute the main responsibility for findFileByIdForUserAndRole.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const findFileByIdForUserAndRole = async ({ fileId, userId, fileRole }) => {
  const result = await query(
    `SELECT *
     FROM uploaded_files
     WHERE id = $1 AND user_id = $2 AND file_role = $3 AND deleted_at IS NULL
     LIMIT 1`,
    [fileId, userId, fileRole]
  );

  return result.rows[0] || null;
};
