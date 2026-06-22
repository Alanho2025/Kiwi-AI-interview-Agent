import { describe, expect, it, vi } from 'vitest';
import { createRecordingUploadManager } from '../recordingUploadManager.js';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

const createMemoryStore = () => {
  let manifest = null;
  const chunks = new Map();
  return {
    getManifest: vi.fn(async () => manifest),
    putManifest: vi.fn(async (next) => { manifest = { ...(manifest || {}), ...next }; return manifest; }),
    putChunk: vi.fn(async (chunk) => { chunks.set(chunk.sequence, { ...chunk }); return chunk; }),
    listChunks: vi.fn(async () => [...chunks.values()].sort((a, b) => a.sequence - b.sequence)),
    updateChunk: vi.fn(async (_sessionId, sequence, patch) => { chunks.set(sequence, { ...chunks.get(sequence), ...patch }); }),
    deleteChunk: vi.fn(async (_sessionId, sequence) => { chunks.delete(sequence); }),
    resetUploading: vi.fn(async () => {
      chunks.forEach((chunk, sequence) => {
        if (chunk.state === 'uploading') chunks.set(sequence, { ...chunk, state: 'pending' });
      });
    }),
    snapshot: () => ({ manifest, chunks: [...chunks.values()] }),
  };
};

const createApi = () => ({
  initialize: vi.fn().mockResolvedValue({ uploadId: 'upload-1', state: 'receiving' }),
  uploadChunk: vi.fn().mockResolvedValue({ state: 'receiving' }),
  finalize: vi.fn().mockResolvedValue({ state: 'queued' }),
});

describe('recording upload manager', () => {
  it('commits a chunk locally before making it eligible for upload', async () => {
    const store = createMemoryStore();
    const api = createApi();
    const manager = createRecordingUploadManager({ sessionId: 'session-1', store, api, checksumBlob: async () => 'hash-1' });

    await manager.enqueueChunk({ sequence: 0, blob: new Blob(['audio']), mimeType: 'audio/webm' });

    expect(store.putChunk).toHaveBeenCalledWith(expect.objectContaining({ sequence: 0, state: 'pending' }));
    expect(store.snapshot().chunks).toHaveLength(1);
    expect(api.uploadChunk).not.toHaveBeenCalled();
  });

  it('uploads pending chunks sequentially and deletes only acknowledged payloads', async () => {
    const store = createMemoryStore();
    const api = createApi();
    const firstUpload = deferred();
    api.uploadChunk.mockImplementationOnce(() => firstUpload.promise).mockResolvedValue({ state: 'receiving' });
    const manager = createRecordingUploadManager({ sessionId: 'session-1', store, api, checksumBlob: async (blob) => `${blob.size}` });
    await manager.enqueueChunk({ sequence: 0, blob: new Blob(['A']), mimeType: 'audio/webm' });
    await manager.enqueueChunk({ sequence: 1, blob: new Blob(['B']), mimeType: 'audio/webm' });

    const startPromise = manager.start();
    await vi.waitFor(() => expect(api.uploadChunk).toHaveBeenCalledTimes(1));
    expect(store.snapshot().chunks).toHaveLength(2);
    firstUpload.resolve({ state: 'receiving' });
    await startPromise;

    expect(api.uploadChunk).toHaveBeenCalledTimes(2);
    expect(store.snapshot().chunks).toHaveLength(0);
  });

  it('reports acknowledged chunk progress before remote finalization completes', async () => {
    const store = createMemoryStore();
    const api = createApi();
    const firstUpload = deferred();
    const secondUpload = deferred();
    api.uploadChunk
      .mockImplementationOnce(() => firstUpload.promise)
      .mockImplementationOnce(() => secondUpload.promise);
    const manager = createRecordingUploadManager({
      sessionId: 'session-1',
      store,
      api,
      checksumBlob: async () => 'hash',
    });
    await manager.enqueueChunk({ sequence: 0, blob: new Blob(['A']), mimeType: 'audio/webm' });
    await manager.enqueueChunk({ sequence: 1, blob: new Blob(['B']), mimeType: 'audio/webm' });

    await manager.finalizeLocalCapture({ totalChunks: 2, totalBytes: 2 });
    await vi.waitFor(() => expect(api.uploadChunk).toHaveBeenCalledTimes(1));
    firstUpload.resolve({ state: 'receiving' });
    await vi.waitFor(() => expect(api.uploadChunk).toHaveBeenCalledTimes(2));

    expect(manager.getSnapshot()).toMatchObject({
      uploadedChunks: 1,
      totalChunks: 2,
      progressPercent: 50,
    });
    secondUpload.resolve({ state: 'receiving' });
  });

  it('reruns the upload pump when a chunk and finalization arrive during an upload', async () => {
    const store = createMemoryStore();
    const api = createApi();
    const firstUpload = deferred();
    api.uploadChunk.mockImplementationOnce(() => firstUpload.promise).mockResolvedValue({ state: 'receiving' });
    const manager = createRecordingUploadManager({
      sessionId: 'session-1',
      store,
      api,
      checksumBlob: async () => 'hash',
    });
    await manager.enqueueChunk({ sequence: 0, blob: new Blob(['A']), mimeType: 'audio/webm' });

    const pump = manager.start();
    await vi.waitFor(() => expect(api.uploadChunk).toHaveBeenCalledTimes(1));
    await manager.enqueueChunk({ sequence: 1, blob: new Blob(['B']), mimeType: 'audio/webm' });
    await manager.finalizeLocalCapture({ totalChunks: 2, totalBytes: 2 });
    firstUpload.resolve({ state: 'receiving' });
    await pump;

    expect(api.uploadChunk).toHaveBeenCalledTimes(2);
    expect(api.finalize).toHaveBeenCalledTimes(1);
    expect(store.snapshot().chunks).toHaveLength(0);
  });

  it('shares one local finalization and does not wait for remote finalization', async () => {
    const store = createMemoryStore();
    const api = createApi();
    const remote = deferred();
    api.finalize.mockReturnValue(remote.promise);
    const manager = createRecordingUploadManager({ sessionId: 'session-1', store, api, checksumBlob: async () => 'hash' });
    await manager.enqueueChunk({ sequence: 0, blob: new Blob(['A']), mimeType: 'audio/webm' });

    const first = manager.finalizeLocalCapture({ totalChunks: 1, totalBytes: 1 });
    const second = manager.finalizeLocalCapture({ totalChunks: 1, totalBytes: 1 });

    expect(first).toBe(second);
    await expect(first).resolves.toMatchObject({ state: 'locally_durable' });
    expect(store.snapshot().manifest.finalized).toBe(true);
    remote.resolve({ state: 'queued' });
  });

  it('resets interrupted uploads and retains chunks while offline', async () => {
    const store = createMemoryStore();
    await store.putChunk({ sequence: 0, state: 'uploading', blob: new Blob(['A']), checksum: 'hash', mimeType: 'audio/webm' });
    const api = createApi();
    api.uploadChunk.mockRejectedValue(new TypeError('Failed to fetch'));
    const manager = createRecordingUploadManager({ sessionId: 'session-1', store, api, checksumBlob: async () => 'hash' });

    await manager.start();

    expect(store.resetUploading).toHaveBeenCalled();
    expect(store.snapshot().chunks[0].state).toBe('pending');
    expect(manager.getSnapshot().state).toBe('waiting_for_network');
  });

  it('retains chunks when upload initialization starts offline', async () => {
    const store = createMemoryStore();
    const api = createApi();
    api.initialize.mockRejectedValue(new TypeError('Failed to fetch'));
    const manager = createRecordingUploadManager({
      sessionId: 'session-1',
      store,
      api,
      checksumBlob: async () => 'hash',
    });
    await manager.enqueueChunk({ sequence: 0, blob: new Blob(['A']), mimeType: 'audio/webm' });

    await expect(manager.start()).resolves.toBeUndefined();

    expect(store.snapshot().chunks).toHaveLength(1);
    expect(manager.getSnapshot().state).toBe('waiting_for_network');
  });

  it('yields to latency-critical voice states and resumes afterward', async () => {
    const store = createMemoryStore();
    const api = createApi();
    let voiceState = 'user_speaking';
    const manager = createRecordingUploadManager({
      sessionId: 'session-1',
      store,
      api,
      checksumBlob: async () => 'hash',
      getVoicePriorityState: () => voiceState,
    });
    await manager.enqueueChunk({ sequence: 0, blob: new Blob(['A']), mimeType: 'audio/webm' });

    await manager.start();
    expect(api.uploadChunk).not.toHaveBeenCalled();
    expect(manager.getSnapshot().state).toBe('paused_for_voice');

    voiceState = 'waiting_for_user';
    await manager.start();
    expect(api.uploadChunk).toHaveBeenCalledTimes(1);
  });
});
