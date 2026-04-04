import crypto from 'crypto';
import { query } from '../db/postgres.js';
import { DocumentContent } from '../db/models/documentContentModel.js';

const formatFileSize = (fileSizeBytes) => {
  const sizeKB = fileSizeBytes / 1024;
  return sizeKB > 1024 ? `${(sizeKB / 1024).toFixed(1)}MB` : `${sizeKB.toFixed(1)}KB`;
};

const formatDisplayDate = (isoDate) =>
  new Date(isoDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const buildCvResponse = (row, document) => ({
  id: row.id,
  name: row.original_filename,
  size: formatFileSize(Number(row.file_size_bytes)),
  updated: formatDisplayDate(row.uploaded_at),
  type: row.mime_type,
  text: document?.normalizedText || document?.rawText || '',
  isDummyData: row.original_filename.includes('[DUMMY DATA]') || false,
});

export const createUploadedFileRecord = async ({
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

export const attachDocumentContent = async ({
  fileId,
  sessionId = null,
  userId,
  documentType,
  rawText,
  normalizedText,
  redactedText = '',
}) => {
  return DocumentContent.findOneAndUpdate(
    { fileId },
    {
      fileId,
      sessionId,
      userId,
      documentType,
      rawText,
      normalizedText,
      redactedText,
      parseStatus: 'completed',
      containsSensitiveData: true,
      retentionUntil: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
};

export const getRecentCvRecords = async (userId, limit = 5) => {
  const result = await query(
    `SELECT *
     FROM uploaded_files
     WHERE user_id = $1 AND file_role = 'cv' AND deleted_at IS NULL
     ORDER BY uploaded_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  const fileIds = result.rows.map((row) => row.id);
  const documents = await DocumentContent.find({ fileId: { $in: fileIds } }).lean();
  const documentsByFileId = new Map(documents.map((doc) => [doc.fileId, doc]));

  return result.rows.map((row) => buildCvResponse(row, documentsByFileId.get(row.id)));
};

export const getCvRecordById = async (fileId, userId) => {
  const result = await query(
    `SELECT *
     FROM uploaded_files
     WHERE id = $1 AND user_id = $2 AND file_role = 'cv' AND deleted_at IS NULL
     LIMIT 1`,
    [fileId, userId]
  );

  if (!result.rows[0]) {
    return null;
  }

  const document = await DocumentContent.findOne({ fileId }).lean();
  return buildCvResponse(result.rows[0], document);
};
