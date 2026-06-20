import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { getEnv } from '../config/env.js';
import {
  RETENTION_AUDIT_ROOT,
  RETENTION_BACKUP_ROOT,
  RETENTION_QUARANTINE_ROOT,
  UPLOADS_ROOT,
} from '../config/retentionConfig.js';
import { connectMongo, disconnectMongo } from '../db/mongo.js';
import { initializeRetentionSchema } from '../db/initializeRetentionSchema.js';
import { closePostgres, query } from '../db/postgres.js';
import { createPostgresRetentionRepository } from '../repositories/postgresRetentionRepository.js';
import { createRetentionJobRepository } from '../repositories/retentionJobRepository.js';
import { createFileQuarantineService } from '../services/retention/fileQuarantineService.js';
import { createRetentionBackupService } from '../services/retention/retentionBackupService.js';
import { createRetentionExecutionService } from '../services/retention/retentionExecutionService.js';
import { buildRetentionJobs } from '../services/retention/retentionJobPlanner.js';
import { createRetentionSagaService } from '../services/retention/retentionSagaService.js';
import { runRetentionDryRun } from '../services/retention/retentionDryRunService.js';
import { loadRetentionAuditFiles } from '../services/retention/retentionDryRunService.js';

const readOption = (name) => {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : '';
};

const runId = readOption('manifest');
const dryRun = process.argv.includes('--dry-run');
const execute = process.argv.includes('--execute');
const approvalToken = readOption('approval');

if (!runId) throw new Error('Retention cleanup requires --manifest=<runId>');
if (dryRun === execute) throw new Error('Choose exactly one mode: --dry-run or --execute');
if (execute && approvalToken !== runId) throw new Error('Execution requires --approval=<runId> matching the reviewed manifest');

const buildLazySagaService = () => {
  let service;
  return {
    execute: async (input) => {
      if (!service) {
        const { createDefaultMongoRetentionRepository } = await import('../repositories/mongoRetentionModelRegistry.js');
        service = createRetentionSagaService({
          jobRepository: createRetentionJobRepository(),
          mongoRepository: createDefaultMongoRetentionRepository(),
          postgresRepository: createPostgresRetentionRepository(),
          fileQuarantine: createFileQuarantineService({
            uploadsRoot: UPLOADS_ROOT,
            quarantineRoot: RETENTION_QUARANTINE_ROOT,
          }),
        });
      }
      return service.execute(input);
    },
  };
};

const writeExecutionReport = async (execution) => {
  const reportPath = path.join(RETENTION_AUDIT_ROOT, runId, 'execution-report.json');
  await fs.writeFile(reportPath, JSON.stringify(execution, null, 2));
  return reportPath;
};

const runApprovedExecution = async () => {
  const mongoUri = getEnv('MONGODB_URI', 'MongoDB_URI', 'MONGO_URI');
  const postgresUrl = getEnv('POSTGRES_URL', 'POSTGRESQL_URL', 'DATABASE_URL');
  mongoose.set('autoIndex', false);
  const jobRepository = createRetentionJobRepository();
  const service = createRetentionExecutionService({
    runDryRun: ({ runId: approvedRunId }) => runRetentionDryRun({
      runId: approvedRunId,
      mongoDb: mongoose.connection.db,
      postgresQuery: query,
    }),
    loadCandidateManifest: async ({ runId: approvedRunId }) => {
      const audit = await loadRetentionAuditFiles({
        runId: approvedRunId,
        keyPath: path.join('/private/tmp', 'kiwi-retention-audit-keys', `${approvedRunId}.key`),
      });
      return audit.candidateManifest;
    },
    backupService: createRetentionBackupService({
      backupRoot: RETENTION_BACKUP_ROOT,
      keyRoot: path.join('/private/tmp', 'kiwi-retention-backup-keys'),
      temporaryRoot: path.join('/private/tmp', 'kiwi-retention-backup-work'),
    }),
    initializeSchema: initializeRetentionSchema,
    planJobs: buildRetentionJobs,
    jobRepository,
    sagaService: buildLazySagaService(),
    writeReport: writeExecutionReport,
  });
  return service.execute({
    runId,
    approvalToken,
    mongoUri,
    postgresUrl,
  });
};

const run = async () => {
  await Promise.all([connectMongo(), query('SELECT 1')]);
  if (execute) {
    const report = await runApprovedExecution();
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  const report = await runRetentionDryRun({ runId, mongoDb: mongoose.connection.db, postgresQuery: query });
  console.log(JSON.stringify({
    runId: report.runId,
    safeToExecute: report.safeToExecute,
    mongoMatched: report.candidates.mongo.matched,
    postgresMatched: report.candidates.postgres.matched,
    reportPath: report.reportPath,
  }, null, 2));
  if (!report.safeToExecute) process.exitCode = 2;
};

run()
  .catch((error) => {
    console.error('[Retention cleanup failed]', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([disconnectMongo(), closePostgres()]);
  });
