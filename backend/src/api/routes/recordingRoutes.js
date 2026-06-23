/**
 * File responsibility: Recording route registration module.
 * Main responsibilities:
 * - Register voice recording upload and MP3 download endpoints.
 * - Keep multer upload handling outside controllers.
 */

import express from 'express';
import multer from 'multer';
import path from 'path';
import { prepareRecordingUploadDirectory, recordingUploadDirectory } from '../../services/recording/sessionRecordingService.js';
import {
  uploadSessionAudio,
  downloadSessionAudio,
  finalizeSessionAudioUpload,
  getSessionAudioStatus,
  getSessionAudioUploadStatus,
  initializeSessionAudioUpload,
  retrySessionAudioUpload,
  uploadSessionAudioChunk,
} from '../../controllers/recordingController.js';
import { getRecordingConfig } from '../../config/recordingConfig.js';

const router = express.Router();

await prepareRecordingUploadDirectory();

const allowedAudioMimeTypes = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-wav',
  'audio/ogg',
]);

const allowedAudioExtensions = new Set(['.webm', '.mp4', '.m4a', '.mp3', '.wav', '.ogg']);

export const isAllowedAudioUpload = (file = {}) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const mimeType = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
  return allowedAudioExtensions.has(extension) && allowedAudioMimeTypes.has(mimeType);
};

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, recordingUploadDirectory);
  },
  filename: (_req, file, callback) => {
    const extension = path.extname(file.originalname || '') || '.webm';
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${extension}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!isAllowedAudioUpload(file)) {
      return callback(new Error('Unsupported audio file type. Please upload a valid browser audio recording.'));
    }

    return callback(null, true);
  },
});

const chunkUpload = multer({
  storage,
  limits: { fileSize: getRecordingConfig().maxChunkBytes },
  fileFilter: (_req, file, callback) => callback(null, isAllowedAudioUpload(file)),
});

router.post('/session-audio', upload.single('audio'), uploadSessionAudio);
router.post('/session-audio/uploads', initializeSessionAudioUpload);
router.put('/session-audio/uploads/:uploadId/chunks/:sequence', chunkUpload.single('audio'), uploadSessionAudioChunk);
router.post('/session-audio/uploads/:uploadId/finalize', finalizeSessionAudioUpload);
router.post('/session-audio/uploads/:uploadId/retry', retrySessionAudioUpload);
router.get('/session-audio/uploads/:uploadId/status', getSessionAudioUploadStatus);
router.get('/session-audio/:sessionId/status', getSessionAudioStatus);
router.get('/session-audio/:sessionId/download', downloadSessionAudio);

export default router;
