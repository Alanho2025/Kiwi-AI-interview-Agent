/**
 * File responsibility: Lightweight background job queue.
 * Main responsibilities:
 * - Move non-critical interview audit, memory, and storage work away from latency-sensitive voice turns.
 * - Keep failures isolated so a background write cannot block the next interview question.
 */

import { logger } from '../utils/logger.js';

const queue = [];
let running = false;

const normalizeMeta = (meta = {}) => ({
  ...meta,
  queuedAt: meta.queuedAt || new Date().toISOString(),
});

export const enqueueBackgroundJob = (name, handler, meta = {}) => {
  if (typeof handler !== 'function') {
    throw new Error('Background job handler must be a function');
  }

  queue.push({
    name: name || 'background-job',
    handler,
    meta: normalizeMeta(meta),
    createdAt: Date.now(),
  });

  runQueueSoon();
};

export const getBackgroundJobQueueSize = () => queue.length;

function runQueueSoon() {
  if (running) return;
  running = true;

  setImmediate(async () => {
    while (queue.length > 0) {
      const job = queue.shift();
      const startedAt = Date.now();

      try {
        await job.handler();
        logger.info('Background job completed', {
          jobName: job.name,
          durationMs: Date.now() - startedAt,
          queueSize: queue.length,
          ...job.meta,
        });
      } catch (error) {
        logger.error('Background job failed', {
          jobName: job.name,
          durationMs: Date.now() - startedAt,
          queueSize: queue.length,
          error,
          ...job.meta,
        });
      }
    }

    running = false;
  });
}
