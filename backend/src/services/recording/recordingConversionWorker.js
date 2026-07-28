import { randomUUID } from 'crypto';
import { logger } from '../../utils/logger.js';
import { getRecordingConfig } from '../../config/recordingConfig.js';
import { recordingUploadRepository } from '../../repositories/recordingUploadRepository.js';
import { recordingChunkStorageService } from './recordingChunkStorageService.js';
import { convertRecordingToMp3 } from './sessionRecordingService.js';

export const createRecordingConversionWorker = ({
  repository,
  storage,
  convertToMp3,
  config = getRecordingConfig(),
  workerId = randomUUID(),
} = {}) => {
  let interval = null;
  let activeRunPromise = null;

  const performRun = async () => {
    const job = await repository.claimReadyJob({ workerId, leaseMs: config.workerLeaseMs });
    if (!job) return { skipped: true, reason: 'no_ready_upload' };
    try {
      const chunks = await repository.listChunks(job.id);
      const inputPath = await storage.assembleChunks({ uploadId: job.id, chunks });
      const temporaryPath = await convertToMp3({ inputPath, outputPath: `${inputPath}.mp3` });
      const published = await storage.publishMp3({ temporaryPath, sessionId: job.session_id });
      await repository.markReady({ uploadId: job.id, storageKey: published.storageKey });
      return { processed: true, uploadId: job.id, ready: true };
    } catch (error) {
      const terminal = Number(job.processing_attempts || 0) >= config.maxProcessingAttempts;
      await repository.markFailed({
        uploadId: job.id,
        status: terminal ? 'failed' : 'recoverable_failed',
        code: 'RECORDING_CONVERSION_FAILED',
        message: error.message || 'Recording conversion failed',
      });
      logger.error('Recording conversion failed', { uploadId: job.id, terminal, error });
      return { processed: true, uploadId: job.id, failed: true, terminal };
    }
  };

  const runOnce = () => {
    if (activeRunPromise) {
      return Promise.resolve({ skipped: true, reason: 'already_running' });
    }

    const execution = performRun();
    activeRunPromise = execution;
    const clearActiveRun = () => {
      if (activeRunPromise === execution) {
        activeRunPromise = null;
      }
    };
    void execution.then(clearActiveRun, clearActiveRun);
    return execution;
  };

  const start = () => {
    if (!config.workerEnabled || interval) return false;
    setImmediate(() => runOnce().catch((error) => logger.error('Recording worker startup failed', { error })));
    interval = setInterval(() => runOnce().catch((error) => logger.error('Recording worker run failed', { error })), config.workerIntervalMs);
    interval.unref?.();
    return true;
  };

  const stop = async () => {
    if (interval) clearInterval(interval);
    interval = null;
    if (activeRunPromise) {
      await activeRunPromise;
    }
  };

  return { runOnce, start, stop };
};

export const startRecordingConversionWorker = (overrides = {}) => {
  const worker = createRecordingConversionWorker({
    repository: recordingUploadRepository,
    storage: recordingChunkStorageService,
    convertToMp3: convertRecordingToMp3,
    ...overrides,
  });
  worker.start();
  return worker;
};
