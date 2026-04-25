/**
 * File responsibility: Latency tracing utility.
 * Main responsibilities:
 * - Record step-level timings for realtime voice turns.
 * - Return structured timing data that can be logged and sent back to the client.
 */

import { logger } from './logger.js';

const now = () => Number(process.hrtime.bigint()) / 1_000_000;

export const createLatencyTrace = (name, meta = {}) => {
  const startedAt = now();
  const marks = [];
  let lastMarkAt = startedAt;

  const mark = (step, extra = {}) => {
    const current = now();
    const record = {
      step,
      msFromStart: Math.round(current - startedAt),
      msFromPrevious: Math.round(current - lastMarkAt),
      ...extra,
    };
    marks.push(record);
    lastMarkAt = current;
    return record;
  };

  const measure = async (step, fn, extra = {}) => {
    const stepStart = now();
    try {
      const result = await fn();
      const durationMs = Math.round(now() - stepStart);
      marks.push({ step, durationMs, ok: true, ...extra });
      lastMarkAt = now();
      return result;
    } catch (error) {
      const durationMs = Math.round(now() - stepStart);
      marks.push({ step, durationMs, ok: false, error: error?.message || String(error), ...extra });
      lastMarkAt = now();
      throw error;
    }
  };

  const toJSON = () => ({
    name,
    totalMs: Math.round(now() - startedAt),
    steps: marks,
    ...meta,
  });

  const log = (message = 'Latency trace') => {
    logger.info(message, toJSON());
  };

  return { mark, measure, toJSON, log };
};
