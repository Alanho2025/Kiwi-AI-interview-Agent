import fs from 'fs/promises';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isAllowedAudioUpload } from '../../../src/api/routes/recordingRoutes.js';
import {
  getSessionRecordingPath,
  getSessionRecordingStatus,
  loadSessionRecordingForDownload,
} from '../../../src/services/recording/sessionRecordingService.js';

vi.mock('../../../src/services/interview/interviewSessionService.js', async () => {
  const actual = await vi.importActual('../../../src/services/interview/interviewSessionService.js');
  return {
    ...actual,
    loadOwnedSessionOrThrow: vi.fn(async ({ sessionId, userId }) => ({ id: sessionId, userId, mode: 'voice' })),
  };
});

const testSessionIds = new Set();

const rememberSessionId = (sessionId) => {
  testSessionIds.add(sessionId);
  return sessionId;
};

afterEach(async () => {
  await Promise.all([...testSessionIds].map((sessionId) => fs.unlink(getSessionRecordingPath(sessionId)).catch(() => {})));
  testSessionIds.clear();
});

describe('recording upload guard', () => {
  it('accepts browser audio recordings and rejects arbitrary files', () => {
    expect(isAllowedAudioUpload({ originalname: 'session.webm', mimetype: 'audio/webm' })).toBe(true);
    expect(isAllowedAudioUpload({ originalname: 'session.m4a', mimetype: 'audio/mp4' })).toBe(true);
    expect(isAllowedAudioUpload({ originalname: 'payload.js', mimetype: 'application/javascript' })).toBe(false);
    expect(isAllowedAudioUpload({ originalname: 'session.webm', mimetype: 'application/octet-stream' })).toBe(false);
  });

  it('reports unavailable status when no MP3 exists for the voice session', async () => {
    const sessionId = rememberSessionId('recording-missing-test');

    const status = await getSessionRecordingStatus({ sessionId, userId: 'user-1' });

    expect(status).toEqual({
      sessionId,
      status: 'missing',
      available: false,
      filename: null,
    });
  });

  it('does not treat a zero-byte MP3 artifact as downloadable', async () => {
    const sessionId = rememberSessionId('recording-empty-test');
    const mp3Path = getSessionRecordingPath(sessionId);
    await fs.mkdir(path.dirname(mp3Path), { recursive: true });
    await fs.writeFile(mp3Path, '');

    const status = await getSessionRecordingStatus({ sessionId, userId: 'user-1' });
    await expect(loadSessionRecordingForDownload({ sessionId, userId: 'user-1' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });

    expect(status.available).toBe(false);
    expect(status.status).toBe('missing');
  });

  it('exposes ready status and file size for a non-empty MP3 artifact', async () => {
    const sessionId = rememberSessionId('recording-ready-test');
    const mp3Path = getSessionRecordingPath(sessionId);
    await fs.mkdir(path.dirname(mp3Path), { recursive: true });
    await fs.writeFile(mp3Path, Buffer.from([0xff, 0xfb, 0x90, 0x64]));

    const status = await getSessionRecordingStatus({ sessionId, userId: 'user-1' });
    const download = await loadSessionRecordingForDownload({ sessionId, userId: 'user-1' });

    expect(status).toEqual({
      sessionId,
      status: 'ready',
      available: true,
      filename: `interview-session-${sessionId}.mp3`,
      fileSizeBytes: 4,
    });
    expect(download).toEqual({
      mp3Path,
      filename: `interview-session-${sessionId}.mp3`,
    });
  });
});
