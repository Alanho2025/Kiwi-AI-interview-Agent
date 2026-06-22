import path from 'path';
import { fileURLToPath } from 'url';
import { getBooleanEnv, getEnv } from './env.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const getRecordingConfig = () => ({
  storageRoot: path.resolve(getEnv('RECORDING_STORAGE_ROOT') || path.join(projectRoot, 'uploads', 'recordings-resumable')),
  maxChunkBytes: Number(getEnv('RECORDING_MAX_CHUNK_BYTES') || 2 * 1024 * 1024),
  maxSessionBytes: Number(getEnv('RECORDING_MAX_SESSION_BYTES') || 100 * 1024 * 1024),
  maxChunks: Number(getEnv('RECORDING_MAX_CHUNKS') || 2000),
  workerEnabled: getBooleanEnv('RECORDING_WORKER_ENABLED', true),
  workerIntervalMs: Number(getEnv('RECORDING_WORKER_INTERVAL_MS') || 2000),
  workerLeaseMs: Number(getEnv('RECORDING_WORKER_LEASE_MS') || 120000),
  maxProcessingAttempts: Number(getEnv('RECORDING_MAX_PROCESSING_ATTEMPTS') || 3),
});
