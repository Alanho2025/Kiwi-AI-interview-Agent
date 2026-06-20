import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from '../db/mongo.js';
import { closePostgres, query } from '../db/postgres.js';
import { generateRetentionAudit } from '../services/retention/retentionAuditService.js';

const run = async () => {
  await Promise.all([connectMongo(), query('SELECT 1')]);
  const result = await generateRetentionAudit({
    mongoDb: mongoose.connection.db,
    postgresQuery: query,
  });
  console.log(JSON.stringify(result, null, 2));
};

run()
  .catch((error) => {
    console.error('[Retention audit failed]', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.allSettled([disconnectMongo(), closePostgres()]);
  });
