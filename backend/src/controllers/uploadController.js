/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: uploadController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';
import { formatSuccess } from '../utils/responseFormatter.js';
import { extractTextFromCV } from '../services/fileService.js';
import * as authService from '../services/authService.js';
import { createAuditLog } from '../services/auditService.js';
import { attachDocumentContent, createUploadedFileRecord, getCvRecordById, getRecentCvRecords } from '../services/fileRepositoryService.js';
import { saveBufferToLocalStorage } from '../services/storageService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { badRequest, notFound } from '../utils/appError.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

export const uploadCV = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw badRequest('No file uploaded', 'Please upload a PDF or DOCX file');
  }

  const text = await extractTextFromCV(req.file.buffer, req.file.mimetype);
  if (!text) {
    throw badRequest('Text extraction failed', 'Could not extract readable text from the uploaded file');
  }

  const user = await authService.resolveUserFromRequest(req);
  const checksum = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
  const storage = await saveBufferToLocalStorage({
    buffer: req.file.buffer,
    originalFilename: req.file.originalname,
    folder: 'cv',
  });

  const fileId = await createUploadedFileRecord({
    userId: user.id,
    fileRole: 'cv',
    originalFilename: req.file.originalname,
    mimeType: req.file.mimetype,
    storageProvider: storage.storageProvider,
    storageKey: storage.storageKey,
    fileSizeBytes: req.file.size,
    checksum,
  });

  await attachDocumentContent({
    fileId,
    userId: user.id,
    documentType: 'cv',
    rawText: text,
    normalizedText: text,
    redactedText: text,
  });

  const fileMetadata = await getCvRecordById(fileId, user.id);
  await createAuditLog({
    actorUserId: user.id,
    targetUserId: user.id,
    actionType: 'upload_cv',
    resourceType: 'uploaded_file',
    resourceId: fileId,
    metadata: { originalFilename: req.file.originalname },
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.info('CV uploaded', getRequestLogMeta(req, {
    userId: user.id,
    fileId,
    originalFilename: req.file.originalname,
  }));

  res.json(formatSuccess('CV uploaded successfully', fileMetadata));
});

export const getRecentCVs = asyncHandler(async (req, res) => {
  const user = await authService.resolveUserFromRequest(req);
  const recentCVs = await getRecentCvRecords(user.id);
  res.json(formatSuccess('Recent CVs retrieved', recentCVs));
});

export const selectCV = asyncHandler(async (req, res) => {
  const { cvId } = req.body;
  if (!cvId) {
    throw badRequest('Missing cvId', 'Please provide a cvId');
  }

  const user = await authService.resolveUserFromRequest(req);
  const selectedCV = await getCvRecordById(cvId, user.id);
  if (!selectedCV) {
    throw notFound('CV not found', 'The selected CV does not exist');
  }

  logger.info('CV selected', getRequestLogMeta(req, { userId: user.id, cvId }));
  res.json(formatSuccess('CV selected successfully', selectedCV));
});
