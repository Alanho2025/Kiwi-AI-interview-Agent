import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadSessionRecording } from '../recordingApi.js';

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
});
