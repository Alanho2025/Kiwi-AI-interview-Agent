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
import { uploadSessionAudio, downloadSessionAudio, getSessionAudioStatus } from '../../controllers/recordingController.js';

const router = express.Router();

await prepareRecordingUploadDirectory();

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
});

router.post('/session-audio', upload.single('audio'), uploadSessionAudio);
router.get('/session-audio/:sessionId/status', getSessionAudioStatus);
router.get('/session-audio/:sessionId/download', downloadSessionAudio);

export default router;
