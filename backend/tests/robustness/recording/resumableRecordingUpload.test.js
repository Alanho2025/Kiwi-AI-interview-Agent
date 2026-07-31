import { describe, expect, it, vi } from 'vitest';
import { createRecordingUploadRepository } from '../../../src/repositories/recordingUploadRepository.js';

describe('Phase 2 - F-75: Resumable Recording Upload & Deduplication Edge Cases', () => {
  it('prevents chunk duplication when client re-uploads an existing chunk sequence', async () => {
    const existingChunk = {
      upload_id: 'upload-resumable-1',
      sequence: 1,
      checksum: 'sha256-chunk-1-hash',
      byte_length: 4096,
    };
    const queryFn = vi.fn()
      .mockResolvedValueOnce({ rows: [] }) // ON CONFLICT DO NOTHING returns 0 rows inserted
      .mockResolvedValueOnce({ rows: [existingChunk] }); // findChunk returns existing

    const repository = createRecordingUploadRepository({ queryFn });

    const result = await repository.insertChunk({
      uploadId: 'upload-resumable-1',
      sequence: 1,
      checksum: 'sha256-chunk-1-hash',
      byteLength: 4096,
      storageKey: 'chunks/upload-resumable-1/1.webm',
    });

    expect(result.inserted).toBe(false);
    expect(result.existing).toEqual(existingChunk);
  });

  it('claims queued conversion jobs idempotently with lease owner tracking', async () => {
    const claimedJob = {
      id: 'upload-resumable-1',
      status: 'processing',
      lease_owner: 'worker-node-1',
      total_chunks: 5,
    };
    const queryFn = vi.fn().mockResolvedValueOnce({ rows: [claimedJob] });
    const repository = createRecordingUploadRepository({ queryFn });

    const job = await repository.claimReadyJob({ workerId: 'worker-node-1', leaseMs: 30000 });

    expect(job).toEqual(claimedJob);
    expect(queryFn.mock.calls[0][0]).toContain('FOR UPDATE SKIP LOCKED');
  });
});
