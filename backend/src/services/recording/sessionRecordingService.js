/**
 * File responsibility: Session recording persistence and MP3 conversion service.
 * Main responsibilities:
 * - Validate that the recording belongs to the signed-in user session.
 * - Convert uploaded browser audio into a user-facing MP3 file.
 * - Serve completed MP3 recordings for review downloads.
 */

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import ffmpegStaticPath from 'ffmpeg-static';
import { fileURLToPath } from 'url';
import { badRequest, notFound } from '../../utils/appError.js';
import { loadOwnedSessionOrThrow, requireSessionId } from '../interview/interviewSessionService.js';
import { recordingChunkStorageService } from './recordingChunkStorageService.js';
import { recordingUploadService } from './recordingUploadService.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..');
const recordingRoot = path.join(projectRoot, 'uploads', 'recordings');
const tempRoot = path.join(recordingRoot, 'tmp');
const mp3Root = path.join(recordingRoot, 'mp3');

const ensureRecordingDirs = async () => {
  await fs.mkdir(tempRoot, { recursive: true });
  await fs.mkdir(mp3Root, { recursive: true });
};

const sanitizeSessionId = (sessionId) => String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '');

const getFfmpegExecutablePath = () => process.env.FFMPEG_PATH || ffmpegStaticPath || 'ffmpeg';

export const runFfmpegConversion = ({ inputPath, outputPath }) => new Promise((resolve, reject) => {
  const ffmpeg = spawn(getFfmpegExecutablePath(), [
    '-y',
    '-i', inputPath,
    '-vn',
    '-codec:a', 'libmp3lame',
    '-b:a', '128k',
    outputPath,
  ]);

  let stderr = '';
  ffmpeg.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  ffmpeg.on('error', (error) => reject(error));
  ffmpeg.on('close', (code) => {
    if (code === 0) {
      resolve(outputPath);
      return;
    }
    reject(new Error(stderr || `ffmpeg exited with code ${code}`));
  });
});

export const convertRecordingToMp3 = async ({ inputPath, outputPath }) => {
  await runFfmpegConversion({ inputPath, outputPath });
  return outputPath;
};

export const getSessionRecordingPath = (sessionId) => {
  const safeSessionId = sanitizeSessionId(sessionId);
  return path.join(mp3Root, `${safeSessionId}.mp3`);
};

const getReadyRecordingMetadata = async (mp3Path) => {
  const stats = await fs.stat(mp3Path);
  return stats.isFile() && stats.size > 0 ? stats : null;
};

const resolveRecordingSource = async ({ sessionId, userId }) => {
  const resumableStatus = await recordingUploadService.getSessionStatus({
    sessionId,
    userId,
  });

  // Once a resumable manifest exists, never silently fall back
  // to the legacy single-file recording.
  if (resumableStatus) {
    if (!resumableStatus.available || resumableStatus.state !== 'ready') {
      return {
        source: 'resumable_chunks',
        state: resumableStatus.state,
        available: false,
        progress: resumableStatus,
        mp3Path: null,
        metadata: null,
      };
    }

    const mp3Path =
      recordingChunkStorageService.getPublishedMp3Path(sessionId);

    try {
      const metadata = await getReadyRecordingMetadata(mp3Path);

      if (!metadata) {
        return {
          source: 'resumable_chunks',
          state: 'processing',
          available: false,
          progress: resumableStatus,
          mp3Path: null,
          metadata: null,
        };
      }

      return {
        source: 'resumable_chunks',
        state: 'ready',
        available: true,
        progress: resumableStatus,
        mp3Path,
        metadata,
      };
    } catch {
      return {
        source: 'resumable_chunks',
        state: 'processing',
        available: false,
        progress: resumableStatus,
        mp3Path: null,
        metadata: null,
      };
    }
  }

  // Legacy fallback is allowed only when no resumable manifest exists.
  const legacyPath = getSessionRecordingPath(sessionId);

  try {
    const metadata = await getReadyRecordingMetadata(legacyPath);

    if (!metadata) {
      return {
        source: null,
        state: 'missing',
        available: false,
        mp3Path: null,
        metadata: null,
      };
    }

    return {
      source: 'legacy_single_file',
      state: 'ready',
      available: true,
      mp3Path: legacyPath,
      metadata,
    };
  } catch {
    return {
      source: null,
      state: 'missing',
      available: false,
      mp3Path: null,
      metadata: null,
    };
  }
};

export const saveSessionRecording = async ({ sessionId, userId, file }) => {
  requireSessionId(sessionId);
  if (!file?.path) {
    throw badRequest('Missing audio file', 'Please upload an audio file.');
  }

  await ensureRecordingDirs();
  await loadOwnedSessionOrThrow({ sessionId, userId });

  const outputPath = getSessionRecordingPath(sessionId);

  try {
    await runFfmpegConversion({ inputPath: file.path, outputPath });
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }

  return {
    sessionId,
    status: 'ready',
    filename: path.basename(outputPath),
  };
};

export const getSessionRecordingStatus = async ({ sessionId, userId }) => {
  requireSessionId(sessionId);
  await ensureRecordingDirs();
  await loadOwnedSessionOrThrow({ sessionId, userId });

  const resolved = await resolveRecordingSource({
    sessionId,
    userId,
  });

  return {
    sessionId,
    status: resolved.state,
    state: resolved.state,
    available: resolved.available,
    recordingSource: resolved.source,
    filename: resolved.available
      ? `interview-session-${sanitizeSessionId(sessionId)}.mp3`
      : null,
    fileSizeBytes: resolved.metadata?.size ?? null,
    receivedChunks: resolved.progress?.receivedChunks ?? null,
    totalChunks: resolved.progress?.totalChunks ?? null,
    missingSequences: resolved.progress?.missingSequences ?? [],
  };
};

export const loadSessionRecordingForDownload = async ({ sessionId, userId }) => {
  requireSessionId(sessionId);
  await ensureRecordingDirs();
  await loadOwnedSessionOrThrow({ sessionId, userId });

  const resolved = await resolveRecordingSource({
    sessionId,
    userId,
  });

  if (!resolved.available || !resolved.mp3Path) {
    throw notFound(
      'Recording not ready',
      resolved.state === 'awaiting_missing_chunks'
        ? 'Recording upload is waiting for missing chunks.'
        : 'The recording is still uploading or processing.',
    );
  }

  return {
    mp3Path: resolved.mp3Path,
    filename: `interview-session-${sanitizeSessionId(sessionId)}.mp3`,
  };
};

export const recordingUploadDirectory = tempRoot;
export const prepareRecordingUploadDirectory = ensureRecordingDirs;
