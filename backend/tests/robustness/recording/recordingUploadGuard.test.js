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
const MISSING_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const EMPTY_SESSION_ID = '00000000-0000-4000-8000-000000000002';
const READY_SESSION_ID = '00000000-0000-4000-8000-000000000003';
const TEST_USER_ID = '00000000-0000-4000-8000-000000000010';
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
    expect(isAllowedAudioUpload({ originalname: 'session.webm', mimetype: 'audio/webm;codecs=opus' })).toBe(true);
    expect(isAllowedAudioUpload({ originalname: 'session.m4a', mimetype: 'audio/mp4' })).toBe(true);
    expect(isAllowedAudioUpload({ originalname: 'payload.js', mimetype: 'application/javascript' })).toBe(false);
    expect(isAllowedAudioUpload({ originalname: 'session.webm', mimetype: 'application/octet-stream' })).toBe(false);
  });

  it('reports unavailable status when no MP3 exists for the voice session', async () => {
    const sessionId = rememberSessionId(MISSING_SESSION_ID);

    const status = await getSessionRecordingStatus({ sessionId, userId: TEST_USER_ID });

    expect(status).toMatchObject({
      sessionId,
      status: 'missing',
      available: false,
      recordingSource: null,
    });
  });

  it('does not treat a zero-byte MP3 artifact as downloadable', async () => {
    const sessionId = rememberSessionId(EMPTY_SESSION_ID);
    const mp3Path = getSessionRecordingPath(sessionId);
    await fs.mkdir(path.dirname(mp3Path), { recursive: true });
    await fs.writeFile(mp3Path, '');

    const status = await getSessionRecordingStatus({ sessionId, userId: TEST_USER_ID });
    await expect(loadSessionRecordingForDownload({ sessionId, userId: TEST_USER_ID })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });

    expect(status.available).toBe(false);
    expect(status.status).toBe('missing');
  });

  it('exposes ready status and file size for a non-empty MP3 artifact', async () => {
    const sessionId = rememberSessionId(READY_SESSION_ID);
    const mp3Path = getSessionRecordingPath(sessionId);
    await fs.mkdir(path.dirname(mp3Path), { recursive: true });
    await fs.writeFile(mp3Path, Buffer.from([0xff, 0xfb, 0x90, 0x64]));

    const status = await getSessionRecordingStatus({ sessionId, userId: TEST_USER_ID });
    const download = await loadSessionRecordingForDownload({ sessionId, userId: TEST_USER_ID });

    expect(status).toMatchObject({
      sessionId,
      status: 'ready',
      available: true,
      recordingSource: 'legacy_single_file',
      fileSizeBytes: 4,
    });
    expect(download).toEqual({
      mp3Path,
      filename: `interview-session-${sessionId}.mp3`,
    });
  });

  it('blocks legacy fallback when an incomplete resumable upload exists alongside a stale 8 KB legacy MP3 file', async () => {
    const sessionId = rememberSessionId('00000000-0000-4000-8000-000000000004');
    const legacyMp3Path = getSessionRecordingPath(sessionId);
    await fs.mkdir(path.dirname(legacyMp3Path), { recursive: true });
    await fs.writeFile(legacyMp3Path, Buffer.alloc(8192)); // Stale 8 KB legacy file

    const { recordingUploadService } = await import('../../../src/services/recording/recordingUploadService.js');
    const spy = vi.spyOn(recordingUploadService, 'getSessionStatus').mockResolvedValue({
      uploadId: 'upload-incomplete',
      sessionId,
      state: 'awaiting_missing_chunks',
      receivedChunks: 1,
      totalChunks: 5,
      receivedBytes: 8192,
      totalBytes: 40960,
      missingSequences: [1, 2, 3, 4],
      available: false,
      retryable: true,
    });

    const status = await getSessionRecordingStatus({ sessionId, userId: TEST_USER_ID });
    await expect(loadSessionRecordingForDownload({ sessionId, userId: TEST_USER_ID })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });

    expect(status).toMatchObject({
      sessionId,
      status: 'awaiting_missing_chunks',
      available: false,
      recordingSource: 'resumable_chunks',
      missingSequences: [1, 2, 3, 4],
    });

    spy.mockRestore();
  });

  it('returns published resumable MP3 when resumable upload is ready, disregarding stale legacy MP3', async () => {
    const sessionId = rememberSessionId('00000000-0000-4000-8000-000000000005');
    const legacyMp3Path = getSessionRecordingPath(sessionId);
    await fs.mkdir(path.dirname(legacyMp3Path), { recursive: true });
    await fs.writeFile(legacyMp3Path, Buffer.alloc(8192)); // Stale 8 KB legacy file

    const { recordingChunkStorageService } = await import('../../../src/services/recording/recordingChunkStorageService.js');
    const publishedMp3Path = recordingChunkStorageService.getPublishedMp3Path(sessionId);
    await fs.mkdir(path.dirname(publishedMp3Path), { recursive: true });
    await fs.writeFile(publishedMp3Path, Buffer.alloc(50000)); // Complete published MP3
    testSessionIds.add(sessionId);

    const { recordingUploadService } = await import('../../../src/services/recording/recordingUploadService.js');
    const spy = vi.spyOn(recordingUploadService, 'getSessionStatus').mockResolvedValue({
      uploadId: 'upload-ready',
      sessionId,
      state: 'ready',
      receivedChunks: 5,
      totalChunks: 5,
      receivedBytes: 50000,
      totalBytes: 50000,
      missingSequences: [],
      available: true,
      retryable: false,
    });

    const status = await getSessionRecordingStatus({ sessionId, userId: TEST_USER_ID });
    const download = await loadSessionRecordingForDownload({ sessionId, userId: TEST_USER_ID });

    expect(status).toMatchObject({
      sessionId,
      status: 'ready',
      available: true,
      recordingSource: 'resumable_chunks',
      fileSizeBytes: 50000,
    });
    expect(download.mp3Path).toBe(publishedMp3Path);

    spy.mockRestore();
    await fs.unlink(publishedMp3Path).catch(() => {});
  });
});
