import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  downloadSessionRecording,
  finalizeRecordingUpload,
  getSessionRecordingStatus,
  initializeRecordingUpload,
  uploadRecordingChunk,
} from '../recordingApi.js';

describe('recording API', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    global.URL.createObjectURL = vi.fn(() => 'blob:recording');
    global.URL.revokeObjectURL = vi.fn();
  });

  it('sends bearer auth when downloading an MP3 recording', async () => {
    window.localStorage.setItem('kiwi_auth_token', 'token-123');
    const click = vi.fn();
    const anchor = { href: '', download: '', click };
    vi.spyOn(document, 'createElement').mockReturnValue(anchor);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'audio/mpeg' }),
      blob: vi.fn().mockResolvedValue(new Blob(['mp3'], { type: 'audio/mpeg' })),
    });

    await downloadSessionRecording('session-1');

    expect(fetch).toHaveBeenCalledWith('/api/recordings/session-audio/session-1/download', {
      method: 'GET',
      credentials: 'include',
      headers: { Authorization: 'Bearer token-123' },
    });
    expect(anchor.download).toBe('interview-session-session-1.mp3');
    expect(click).toHaveBeenCalled();
  });

  it('surfaces backend JSON errors when a recording is unavailable', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({
        error: { details: 'No MP3 recording is available for this session yet.' },
      }),
    });

    await expect(downloadSessionRecording('session-1')).rejects.toThrow(
      'No MP3 recording is available for this session yet.'
    );
  });

  it('initializes and finalizes a resumable recording upload', async () => {
    window.localStorage.setItem('kiwi_auth_token', 'token-123');
    global.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ data: { uploadId: 'upload-1', state: 'receiving' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: vi.fn().mockResolvedValue({ data: { uploadId: 'upload-1', state: 'queued' } }),
      });

    await expect(initializeRecordingUpload({ sessionId: 'session-1', mimeType: 'audio/webm' }))
      .resolves.toMatchObject({ uploadId: 'upload-1', state: 'receiving' });
    await expect(finalizeRecordingUpload({ uploadId: 'upload-1', totalChunks: 2, totalBytes: 20 }))
      .resolves.toMatchObject({ state: 'queued' });

    expect(fetch.mock.calls[0][0]).toBe('/api/recordings/session-audio/uploads');
    expect(fetch.mock.calls[1][0]).toBe('/api/recordings/session-audio/uploads/upload-1/finalize');
  });

  it('uploads a chunk as form data with its checksum', async () => {
    window.localStorage.setItem('kiwi_auth_token', 'token-123');
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ data: { uploadId: 'upload-1', state: 'receiving', receivedChunks: 1 } }),
    });

    await uploadRecordingChunk({
      uploadId: 'upload-1',
      sequence: 0,
      checksum: 'hash-1',
      blob: new Blob(['audio'], { type: 'audio/webm' }),
    });

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('/api/recordings/session-audio/uploads/upload-1/chunks/0');
    expect(options.body).toBeInstanceOf(FormData);
    expect(options.body.get('checksum')).toBe('hash-1');
  });

  it('normalizes legacy and resumable session recording states', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: vi.fn().mockResolvedValue({ data: { state: 'processing', receivedBytes: 50, totalBytes: 100, available: false } }),
    });

    await expect(getSessionRecordingStatus('session-1')).resolves.toMatchObject({
      state: 'processing',
      progressPercent: 50,
      available: false,
    });
  });
});
