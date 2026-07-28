import { logger } from '../../utils/logger.js';
import {
  getRetentionWorkerConfig,
  RETENTION_QUARANTINE_ROOT,
  UPLOADS_ROOT,
} from '../../config/retentionConfig.js';
import { createDefaultMongoRetentionRepository } from '../../repositories/mongoRetentionModelRegistry.js';
import { createPostgresRetentionRepository } from '../../repositories/postgresRetentionRepository.js';
import { createRetentionJobRepository } from '../../repositories/retentionJobRepository.js';
import { createFileQuarantineService } from './fileQuarantineService.js';
import { createRetentionSagaService } from './retentionSagaService.js';

export const createRetentionWorker = ({
  config = getRetentionWorkerConfig(),
  jobRepository = createRetentionJobRepository(),
  sagaService = null,
} = {}) => {
  const service = sagaService || createRetentionSagaService({
    jobRepository,
    mongoRepository: createDefaultMongoRetentionRepository(),
    postgresRepository: createPostgresRetentionRepository(),
    fileQuarantine: createFileQuarantineService({
      uploadsRoot: UPLOADS_ROOT,
      quarantineRoot: RETENTION_QUARANTINE_ROOT,
    }),
  });
  let interval = null;
  let activeRunPromise = null;

  const performRun = async () => {
    const jobs = await jobRepository.listReadyJobs({ limit: config.batchSize });
    const results = [];
    for (const job of jobs) {
      try {
        results.push(await service.execute({ jobId: job.id }));
      } catch (error) {
        logger.error('Retention cleanup job failed', { jobId: job.id, state: job.state, error });
      }
    }
    return { skipped: false, processed: jobs.length, results };
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
    if (!config.enabled || interval) return false;
    setImmediate(() => runOnce().catch((error) => logger.error('Retention worker startup run failed', { error })));
    interval = setInterval(() => {
      runOnce().catch((error) => logger.error('Retention worker scheduled run failed', { error }));
    }, config.intervalMs);
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

export const startRetentionWorker = (options = {}) => {
  const worker = createRetentionWorker(options);
  worker.start();
  return worker;
};
