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
import { saveSessionRecording, loadSessionRecordingForDownload, getSessionRecordingStatus } from '../services/recording/sessionRecordingService.js';
import { recordingUploadService } from '../services/recording/recordingUploadService.js';

export const initializeSessionAudioUpload = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const result = await recordingUploadService.initialize({
    sessionId: req.body?.sessionId,
    userId: user.id,
    mimeType: req.body?.mimeType,
  });
  res.json(formatSuccess('Recording upload initialized', result));
});

export const uploadSessionAudioChunk = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const result = await recordingUploadService.uploadChunk({
    uploadId: req.params.uploadId,
    userId: user.id,
    sequence: Number(req.params.sequence),
    checksum: req.body?.checksum,
    file: req.file,
  });
  res.json(formatSuccess('Recording chunk stored', result));
});

export const finalizeSessionAudioUpload = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const result = await recordingUploadService.finalize({
    uploadId: req.params.uploadId,
    userId: user.id,
    totalChunks: Number(req.body?.totalChunks),
    totalBytes: Number(req.body?.totalBytes),
  });
  res.json(formatSuccess('Recording upload finalized', result));
});

export const retrySessionAudioUpload = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const result = await recordingUploadService.retry({ uploadId: req.params.uploadId, userId: user.id });
  res.json(formatSuccess('Recording conversion requeued', result));
});

export const getSessionAudioUploadStatus = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const result = await recordingUploadService.getStatus({ uploadId: req.params.uploadId, userId: user.id });
  res.json(formatSuccess('Recording upload status loaded', result));
});

export const uploadSessionAudio = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const result = await saveSessionRecording({
    sessionId: req.body?.sessionId,
    userId: user.id,
    file: req.file,
  });

  res.json(formatSuccess('Session recording saved', result));
});

export const getSessionAudioStatus = asyncHandler(async (req, res) => {
  const user = await resolveUserFromRequest(req);
  const result = await getSessionRecordingStatus({
    sessionId: req.params.sessionId,
    userId: user.id,
  });

  res.json(formatSuccess('Session recording status loaded', result));
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
