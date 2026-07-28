import { describe, expect, it, vi } from 'vitest';

import {
  createRetentionWorker,
  startRetentionWorker,
} from '../../../src/services/retention/retentionWorker.js';

describe('retention worker lifecycle', () => {
  it('returns a stoppable worker instance from the production start helper', () => {
    const worker = startRetentionWorker({
      config: {
        batchSize: 10,
        enabled: false,
        intervalMs: 1000,
      },
      jobRepository: {
        listReadyJobs: vi.fn(),
      },
      sagaService: {
        execute: vi.fn(),
      },
    });

    expect(worker).toMatchObject({
      runOnce: expect.any(Function),
      start: expect.any(Function),
      stop: expect.any(Function),
    });
  });

  it('waits for an in-flight retention run before stop resolves', async () => {
    let releaseJobs;
    const worker = createRetentionWorker({
      config: {
        batchSize: 10,
        enabled: true,
        intervalMs: 1000,
      },
      jobRepository: {
        listReadyJobs: vi.fn(() => new Promise((resolve) => {
          releaseJobs = resolve;
        })),
      },
      sagaService: {
        execute: vi.fn(),
      },
    });
    const activeRun = worker.runOnce();
    let stopResolved = false;

    const stopping = worker.stop().then(() => {
      stopResolved = true;
    });
    await Promise.resolve();

    expect(stopResolved).toBe(false);

    releaseJobs([]);
    await activeRun;
    await stopping;

    expect(stopResolved).toBe(true);
  });
});
