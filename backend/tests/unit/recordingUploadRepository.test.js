import { describe, expect, it, vi } from 'vitest';
import { createRecordingUploadRepository } from '../../src/repositories/recordingUploadRepository.js';

describe('recording upload repository', () => {
  it('returns the existing session upload before creating another manifest', async () => {
    const existing = { id: 'upload-1', session_id: 'session-1', user_id: 'user-1', status: 'receiving' };
    const queryFn = vi.fn().mockResolvedValueOnce({ rows: [existing] });
    const repository = createRecordingUploadRepository({ queryFn });

    const result = await repository.findOrCreateActive({
      sessionId: 'session-1',
      userId: 'user-1',
      mimeType: 'audio/webm',
    });

    expect(result).toEqual(existing);
    expect(queryFn).toHaveBeenCalledTimes(1);
    expect(queryFn.mock.calls[0][0]).toContain('FROM recording_uploads');
  });

  it('creates a manifest when the session has no recording upload', async () => {
    const created = { id: 'upload-1', session_id: 'session-1', user_id: 'user-1', status: 'receiving' };
    const queryFn = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [created] });
    const repository = createRecordingUploadRepository({ queryFn });

    const result = await repository.findOrCreateActive({
      sessionId: 'session-1',
      userId: 'user-1',
      mimeType: 'audio/webm',
    });

    expect(result).toEqual(created);
    expect(queryFn.mock.calls[1][0]).toContain('INSERT INTO recording_uploads');
  });

  it('stores one chunk per sequence and exposes an existing conflict for the service', async () => {
    const existing = { upload_id: 'upload-1', sequence: 2, checksum: 'old', byte_length: 10 };
    const queryFn = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [existing] });
    const repository = createRecordingUploadRepository({ queryFn });

    const result = await repository.insertChunk({
      uploadId: 'upload-1',
      sequence: 2,
      checksum: 'new',
      byteLength: 12,
      storageKey: 'chunks/upload-1/2.webm',
    });

    expect(result).toEqual({ inserted: false, existing });
    expect(queryFn.mock.calls[0][0]).toContain('ON CONFLICT (upload_id, sequence) DO NOTHING');
  });

  it('loads one existing chunk by upload and sequence', async () => {
    const chunk = { upload_id: 'upload-1', sequence: 2, checksum: 'hash-2' };
    const queryFn = vi.fn().mockResolvedValue({ rows: [chunk] });
    const repository = createRecordingUploadRepository({ queryFn });

    await expect(repository.findChunk({ uploadId: 'upload-1', sequence: 2 })).resolves.toEqual(chunk);
    expect(queryFn.mock.calls[0][0]).toContain('WHERE upload_id = $1 AND sequence = $2');
  });

  it('finalizes a manifest and claims queued conversion work with a lease', async () => {
    const finalized = { id: 'upload-1', status: 'queued', total_chunks: 2, total_bytes: 20 };
    const claimed = { ...finalized, status: 'processing', lease_owner: 'worker-1' };
    const queryFn = vi.fn()
      .mockResolvedValueOnce({ rows: [finalized] })
      .mockResolvedValueOnce({ rows: [claimed] });
    const repository = createRecordingUploadRepository({ queryFn });

    await expect(repository.finalizeManifest({ uploadId: 'upload-1', totalChunks: 2, totalBytes: 20 }))
      .resolves.toEqual(finalized);
    await expect(repository.claimReadyJob({ workerId: 'worker-1', leaseMs: 30000 }))
      .resolves.toEqual(claimed);

    expect(queryFn.mock.calls[0][0]).toContain("status = 'queued'");
    expect(queryFn.mock.calls[1][0]).toContain('FOR UPDATE SKIP LOCKED');
  });
});
