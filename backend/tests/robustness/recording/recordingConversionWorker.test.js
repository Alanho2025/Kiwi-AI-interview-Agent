import { describe, expect, it, vi } from 'vitest';
import { createRecordingConversionWorker } from '../../../src/services/recording/recordingConversionWorker.js';

const buildWorker = ({ conversionError = null, attempts = 1 } = {}) => {
  const job = {
    id: 'upload-1',
    session_id: 'session-1',
    status: 'processing',
    processing_attempts: attempts,
  };
  const repository = {
    claimReadyJob: vi.fn().mockResolvedValue(job),
    listChunks: vi.fn().mockResolvedValue([
      { sequence: 0, storage_key: 'chunks/upload-1/0.webm' },
      { sequence: 1, storage_key: 'chunks/upload-1/1.webm' },
    ]),
    markReady: vi.fn().mockResolvedValue({ ...job, status: 'ready' }),
    markFailed: vi.fn().mockResolvedValue({ ...job, status: 'recoverable_failed' }),
  };
  const storage = {
    assembleChunks: vi.fn().mockResolvedValue('/tmp/source.webm'),
    publishMp3: vi.fn().mockResolvedValue({ storageKey: 'mp3/session-1.mp3' }),
  };
  const convertToMp3 = conversionError
    ? vi.fn().mockRejectedValue(conversionError)
    : vi.fn().mockResolvedValue('/tmp/output.mp3');
  const worker = createRecordingConversionWorker({
    repository,
    storage,
    convertToMp3,
    config: { workerEnabled: true, workerIntervalMs: 1000, workerLeaseMs: 30000, maxProcessingAttempts: 3 },
    workerId: 'worker-1',
  });
  return { worker, repository, storage, convertToMp3 };
};

describe('recording conversion worker', () => {
  it('assembles, converts and atomically publishes one claimed upload', async () => {
    const context = buildWorker();

    const result = await context.worker.runOnce();

    expect(result).toMatchObject({ processed: true, uploadId: 'upload-1' });
    expect(context.storage.assembleChunks).toHaveBeenCalledWith(expect.objectContaining({ uploadId: 'upload-1' }));
    expect(context.convertToMp3).toHaveBeenCalledWith(expect.objectContaining({ inputPath: '/tmp/source.webm' }));
    expect(context.storage.publishMp3).toHaveBeenCalledWith({ temporaryPath: '/tmp/output.mp3', sessionId: 'session-1' });
    expect(context.repository.markReady).toHaveBeenCalledWith({ uploadId: 'upload-1', storageKey: 'mp3/session-1.mp3' });
  });

  it('keeps chunks and records a recoverable failure before the retry budget is exhausted', async () => {
    const context = buildWorker({ conversionError: new Error('ffmpeg failed'), attempts: 1 });

    await expect(context.worker.runOnce()).resolves.toMatchObject({ processed: true, failed: true });

    expect(context.repository.markFailed).toHaveBeenCalledWith(expect.objectContaining({
      uploadId: 'upload-1',
      status: 'recoverable_failed',
      code: 'RECORDING_CONVERSION_FAILED',
    }));
    expect(context.storage.publishMp3).not.toHaveBeenCalled();
  });

  it('marks the upload terminally failed after the retry budget', async () => {
    const context = buildWorker({ conversionError: new Error('ffmpeg failed'), attempts: 3 });

    await context.worker.runOnce();

    expect(context.repository.markFailed).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
