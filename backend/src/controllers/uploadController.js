import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { extractTextFromCV } from '../services/fileService.js';
import crypto from 'crypto';
import * as authService from '../services/authService.js';
import { createAuditLog } from '../services/auditService.js';
import { attachDocumentContent, createUploadedFileRecord, getCvRecordById, getRecentCvRecords } from '../services/fileRepositoryService.js';
import { saveBufferToLocalStorage } from '../services/storageService.js';

export const uploadCV = async (req, res, next) => {
  console.log('ENTERING uploadCV, file:', req.file?.originalname);
  try {
    if (!req.file) {
      return res.status(400).json(formatError('No file uploaded', 'MISSING_FILE', 'Please upload a PDF or DOCX file'));
    }

    console.log('Calling fileService extractTextFromCV');
    const text = await extractTextFromCV(req.file.buffer, req.file.mimetype);
    if (!text) {
      return res.status(400).json(formatError('Text extraction failed', 'EXTRACTION_FAILED', 'Could not extract readable text from the uploaded file'));
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

    console.log('EXITING uploadCV successfully');
    res.json(formatSuccess('CV uploaded successfully', fileMetadata));
  } catch (error) {
    console.error('ERROR in uploadCV:', error.message, error.stack);
    next(error);
  }
};

export const getRecentCVs = async (req, res, next) => {
  console.log('ENTERING getRecentCVs');
  try {
    const user = await authService.resolveUserFromRequest(req);
    const recentCVs = await getRecentCvRecords(user.id);
    console.log('EXITING getRecentCVs successfully');
    res.json(formatSuccess('Recent CVs retrieved', recentCVs));
  } catch (error) {
    console.error('ERROR in getRecentCVs:', error.message, error.stack);
    next(error);
  }
};

export const selectCV = async (req, res, next) => {
  console.log('ENTERING selectCV, cvId:', req.body?.cvId);
  try {
    const { cvId } = req.body;
    if (!cvId) {
      return res.status(400).json(formatError('Missing cvId', 'MISSING_PARAM', 'Please provide a cvId'));
    }

    const user = await authService.resolveUserFromRequest(req);
    const selectedCV = await getCvRecordById(cvId, user.id);
    if (!selectedCV) {
      return res.status(404).json(formatError('CV not found', 'NOT_FOUND', 'The selected CV does not exist'));
    }

    console.log('EXITING selectCV successfully');
    res.json(formatSuccess('CV selected successfully', selectedCV));
  } catch (error) {
    console.error('ERROR in selectCV:', error.message, error.stack);
    next(error);
  }
};
