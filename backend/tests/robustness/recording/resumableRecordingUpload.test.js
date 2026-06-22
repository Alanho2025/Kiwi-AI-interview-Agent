import { describe, expect, it, vi } from 'vitest';
import { createRecordingUploadService } from '../../../src/services/recording/recordingUploadService.js';

const buildDependencies = () => {
  const manifest = {
    id: 'upload-1', session_id: 'session-1', user_id: 'user-1', status: 'receiving',
    mime_type: 'audio/webm', received_chunks: 0, received_bytes: 0,
  };
  return {
    manifest,
    repository: {
      findOrCreateActive: vi.fn().mockResolvedValue(manifest),
      findOwnedById: vi.fn().mockResolvedValue(manifest),
      findChunk: vi.fn().mockResolvedValue(null),
      insertChunk: vi.fn().mockResolvedValue({ inserted: true, chunk: { sequence: 0 } }),
      refreshCounters: vi.fn().mockResolvedValue({ ...manifest, received_chunks: 1, received_bytes: 4 }),
      listChunks: vi.fn().mockResolvedValue([{ sequence: 0, byte_length: 4 }]),
      finalizeManifest: vi.fn().mockResolvedValue({ ...manifest, status: 'queued', total_chunks: 1, total_bytes: 4 }),
      queueRetry: vi.fn().mockResolvedValue({ ...manifest, status: 'queued' }),
    },
    storage: {
      persistChunk: vi.fn().mockResolvedValue({ storageKey: 'chunks/upload-1/0.webm' }),
      deleteChunk: vi.fn().mockResolvedValue(undefined),
      discardTemporaryFile: vi.fn().mockResolvedValue(undefined),
    },
    loadOwnedSession: vi.fn().mockResolvedValue({ id: 'session-1', userId: 'user-1', mode: 'voice' }),
  };
};

describe('resumable recording upload', () => {
  it('initializes one owned upload and returns normalized status', async () => {
    const dependencies = buildDependencies();
    const service = createRecordingUploadService(dependencies);

    await expect(service.initialize({ sessionId: 'session-1', userId: 'user-1', mimeType: 'audio/webm' }))
      .resolves.toMatchObject({ uploadId: 'upload-1', sessionId: 'session-1', state: 'receiving', available: false });
  });

  it('accepts an identical duplicate without writing another file', async () => {
    const dependencies = buildDependencies();
    dependencies.repository.findChunk.mockResolvedValue({ sequence: 0, checksum: 'hash-1' });
    dependencies.repository.refreshCounters.mockResolvedValue({
      ...dependencies.manifest,
      received_chunks: 1,
      received_bytes: 4,
    });
    const service = createRecordingUploadService(dependencies);

    const result = await service.uploadChunk({
      uploadId: 'upload-1',
      userId: 'user-1',
      sequence: 0,
      checksum: 'hash-1',
      file: { path: '/tmp/duplicate', size: 4, mimetype: 'audio/webm' },
    });

    expect(result.receivedChunks).toBe(1);
    expect(dependencies.storage.persistChunk).not.toHaveBeenCalled();
    expect(dependencies.storage.discardTemporaryFile).toHaveBeenCalledWith('/tmp/duplicate');
    expect(dependencies.repository.insertChunk).not.toHaveBeenCalled();
  });

  it('rejects a conflicting duplicate without replacing the stored chunk', async () => {
    const dependencies = buildDependencies();
    dependencies.repository.findChunk.mockResolvedValue({ sequence: 0, checksum: 'hash-old' });
    const service = createRecordingUploadService(dependencies);

    await expect(service.uploadChunk({
      uploadId: 'upload-1',
      userId: 'user-1',
      sequence: 0,
      checksum: 'hash-new',
      file: { path: '/tmp/conflict', size: 4, mimetype: 'audio/webm' },
    })).rejects.toThrow('checksum conflict');

    expect(dependencies.storage.persistChunk).not.toHaveBeenCalled();
    expect(dependencies.storage.discardTemporaryFile).toHaveBeenCalledWith('/tmp/conflict');
  });

  it('discards a temporary upload when chunk validation fails', async () => {
    const dependencies = buildDependencies();
    const service = createRecordingUploadService(dependencies);

    await expect(service.uploadChunk({
      uploadId: 'upload-1',
      userId: 'user-1',
      sequence: -1,
      checksum: 'hash',
      file: { path: '/tmp/invalid-sequence', size: 4, mimetype: 'audio/webm' },
    })).rejects.toThrow('Invalid recording chunk sequence');

    expect(dependencies.storage.discardTemporaryFile).toHaveBeenCalledWith('/tmp/invalid-sequence');
    expect(dependencies.storage.persistChunk).not.toHaveBeenCalled();
  });

  it('persists a chunk before acknowledging it and queues a complete manifest once', async () => {
    const dependencies = buildDependencies();
    const service = createRecordingUploadService(dependencies);
    const file = { path: '/tmp/chunk', size: 4, mimetype: 'audio/webm' };

    const uploaded = await service.uploadChunk({
      uploadId: 'upload-1', userId: 'user-1', sequence: 0, checksum: 'hash-1', file,
    });
    const finalized = await service.finalize({
      uploadId: 'upload-1', userId: 'user-1', totalChunks: 1, totalBytes: 4,
    });

    expect(dependencies.storage.persistChunk).toHaveBeenCalledBefore(dependencies.repository.insertChunk);
    expect(dependencies.storage.persistChunk).toHaveBeenCalledWith({
      uploadId: 'upload-1',
      sequence: 0,
      checksum: 'hash-1',
      file,
    });
    expect(uploaded).toMatchObject({ receivedChunks: 1, receivedBytes: 4 });
    expect(finalized).toMatchObject({ state: 'queued', missingSequences: [] });
  });

  it('reports missing sequences instead of queueing an incomplete manifest', async () => {
    const dependencies = buildDependencies();
    dependencies.repository.listChunks.mockResolvedValue([{ sequence: 0, byte_length: 4 }]);
    const service = createRecordingUploadService(dependencies);

    const result = await service.finalize({ uploadId: 'upload-1', userId: 'user-1', totalChunks: 3, totalBytes: 12 });

    expect(result).toMatchObject({ state: 'awaiting_missing_chunks', missingSequences: [1, 2] });
    expect(dependencies.repository.finalizeManifest).not.toHaveBeenCalled();
  });

  it('returns status and requeues a recoverable conversion failure', async () => {
    const dependencies = buildDependencies();
    dependencies.manifest.status = 'recoverable_failed';
    dependencies.repository.findOwnedById.mockResolvedValue(dependencies.manifest);
    const service = createRecordingUploadService(dependencies);

    await expect(service.getStatus({ uploadId: 'upload-1', userId: 'user-1' }))
      .resolves.toMatchObject({ state: 'recoverable_failed', retryable: true });
    await expect(service.retry({ uploadId: 'upload-1', userId: 'user-1' }))
      .resolves.toMatchObject({ state: 'queued' });
  });

  it('returns the active upload status for a session', async () => {
    const dependencies = buildDependencies();
    dependencies.repository.findOwnedBySession = vi.fn().mockResolvedValue(dependencies.manifest);
    const service = createRecordingUploadService(dependencies);

    await expect(service.getSessionStatus({ sessionId: 'session-1', userId: 'user-1' }))
      .resolves.toMatchObject({ uploadId: 'upload-1', state: 'receiving' });
  });
});
