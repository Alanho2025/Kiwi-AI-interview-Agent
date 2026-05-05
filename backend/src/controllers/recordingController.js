/**
 * File responsibility: Recording HTTP controller.
 * Main responsibilities:
 * - Accept voice session audio uploads.
 * - Trigger backend MP3 conversion.
 * - Stream MP3 recordings back to the user for review.
 */

import { formatSuccess } from '../utils/responseFormatter.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { saveSessionRecording, loadSessionRecordingForDownload } from '../services/recording/sessionRecordingService.js';

export const uploadSessionAudio = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const result = await saveSessionRecording({
    sessionId: req.body?.sessionId,
    userId: user.id,
    file: req.file,
  });

  res.json(formatSuccess('Session recording saved', result));
});

export const downloadSessionAudio = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const { mp3Path, filename } = await loadSessionRecordingForDownload({
    sessionId: req.params.sessionId,
    userId: user.id,
  });

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.sendFile(mp3Path);
});
