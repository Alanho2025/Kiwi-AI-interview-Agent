import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../db/mongo.js';
import { closePostgres, query } from '../db/postgres.js';
import { runRetentionDryRun } from '../services/retention/retentionDryRunService.js';

const readOption = (name) => {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : '';
};

const runId = readOption('manifest');
const dryRun = process.argv.includes('--dry-run');
const execute = process.argv.includes('--execute');

if (!runId) throw new Error('Retention cleanup requires --manifest=<runId>');
if (dryRun === execute) throw new Error('Choose exactly one mode: --dry-run or --execute');
if (execute) {
  throw new Error('Destructive retention execution is locked until the reviewed dry-run receives explicit approval');
}

const run = async () => {
  await Promise.all([connectMongo(), query('SELECT 1')]);
  const report = await runRetentionDryRun({
    runId,
    mongoDb: mongoose.connection.db,
    postgresQuery: query,
  });
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
