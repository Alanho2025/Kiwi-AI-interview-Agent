import path from 'path';
import { fileURLToPath } from 'url';
import { getBooleanEnv, getEnv } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '../..');

export const RETENTION_DAYS = 7;
export const RETENTION_BATCH_SIZE = 100;
export const RETENTION_WORKER_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const RETENTION_WARNING_PERCENT = 70;
export const RETENTION_CRITICAL_PERCENT = 85;
export const RETENTION_SMOKE_CASES_PER_LABEL = 10;
export const RETENTION_AUDIT_ROOT = path.join(backendRoot, 'tmp', 'retention-audit');
export const RETENTION_BACKUP_ROOT = path.join(backendRoot, 'tmp', 'retention-backups');
export const RETENTION_QUARANTINE_ROOT = path.join(backendRoot, 'tmp', 'retention-quarantine');
export const UPLOADS_ROOT = path.join(backendRoot, 'uploads');

export const getRetentionWorkerConfig = () => ({
  enabled: getBooleanEnv('RETENTION_WORKER_ENABLED', false),
  intervalMs: Number(getEnv('RETENTION_WORKER_INTERVAL_MS') || RETENTION_WORKER_INTERVAL_MS),
  batchSize: Number(getEnv('RETENTION_BATCH_SIZE') || RETENTION_BATCH_SIZE),
});
