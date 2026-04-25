/**
 * File responsibility: Voice upload middleware.
 * Main responsibilities:
 * - Accept short WAV uploads for session-aware voice turns.
 * - Keep file validation separate from controller logic.
 */

import multer from 'multer';

const storage = multer.memoryStorage();
const allowedMimeTypes = new Set([
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
]);

export const isAllowedVoiceFile = (file = {}) => {
  const filename = String(file.originalname || '').toLowerCase();
  const mimetype = String(file.mimetype || '').toLowerCase();
  return filename.endsWith('.wav') || allowedMimeTypes.has(mimetype);
};

export const voiceUploadMiddleware = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!isAllowedVoiceFile(file)) {
      return cb(new Error('Only WAV audio files are allowed for the voice interview flow'));
    }

    return cb(null, true);
  },
}).single('audio');
