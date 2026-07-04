import { describe, expect, it, vi } from 'vitest';
import {
  registerRecordingUploadServiceWorker,
  requestRecordingBackgroundSync,
} from '../recordingBackgroundSync.js';

describe('recording background sync', () => {
  it('registers the recording service worker when supported', async () => {
    const registration = { scope: '/' };
    const serviceWorker = { register: vi.fn().mockResolvedValue(registration) };

    await expect(registerRecordingUploadServiceWorker({ serviceWorker })).resolves.toBe(registration);
    expect(serviceWorker.register).toHaveBeenCalledWith('/recording-upload-worker.js');
  });

  it('does nothing when service workers are unavailable', async () => {
    await expect(registerRecordingUploadServiceWorker({ serviceWorker: null })).resolves.toBeNull();
  });

  it('requests the upload sync tag when Background Sync is supported', async () => {
    const register = vi.fn().mockResolvedValue(undefined);
    const serviceWorker = { ready: Promise.resolve({ sync: { register } }) };

    await requestRecordingBackgroundSync({ serviceWorker });

    expect(register).toHaveBeenCalledWith('kiwi-recording-upload');
  });
});
