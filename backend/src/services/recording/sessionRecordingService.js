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
import { fileURLToPath } from 'url';
import { badRequest, notFound } from '../../utils/appError.js';
import { loadOwnedSessionOrThrow, requireSessionId } from '../interview/interviewSessionService.js';

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

const runFfmpegConversion = ({ inputPath, outputPath }) => new Promise((resolve, reject) => {
  const ffmpeg = spawn('ffmpeg', [
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

export const getSessionRecordingPath = (sessionId) => {
  const safeSessionId = sanitizeSessionId(sessionId);
  return path.join(mp3Root, `${safeSessionId}.mp3`);
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

  const mp3Path = getSessionRecordingPath(sessionId);
  try {
    await fs.access(mp3Path);
    return {
      sessionId,
      status: 'ready',
      available: true,
      filename: `interview-session-${sanitizeSessionId(sessionId)}.mp3`,
    };
  } catch {
    return {
      sessionId,
      status: 'missing',
      available: false,
      filename: null,
    };
  }
};

export const loadSessionRecordingForDownload = async ({ sessionId, userId }) => {
  requireSessionId(sessionId);
  await ensureRecordingDirs();
  await loadOwnedSessionOrThrow({ sessionId, userId });

  const mp3Path = getSessionRecordingPath(sessionId);
  try {
    await fs.access(mp3Path);
  } catch {
    throw notFound('Recording not found', 'No MP3 recording is available for this session yet.');
  }

  return {
    mp3Path,
    filename: `interview-session-${sanitizeSessionId(sessionId)}.mp3`,
  };
};

export const recordingUploadDirectory = tempRoot;
export const prepareRecordingUploadDirectory = ensureRecordingDirs;
