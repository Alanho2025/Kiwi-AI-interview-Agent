/**
 * File responsibility: Voice upload middleware.
 * Main responsibilities:
 * - Accept short audio uploads for speech smoke tests.
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

export const voiceUploadMiddleware = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filename = String(file.originalname || '').toLowerCase();
    const mimetype = String(file.mimetype || '').toLowerCase();
    const isWav = filename.endsWith('.wav') || allowedMimeTypes.has(mimetype);

    if (!isWav) {
      return cb(new Error('Only WAV audio files are allowed for voice smoke tests'));
    }

    return cb(null, true);
  },
}).single('audio');
