import { connectMongo } from './mongo.js';
import { initPostgresSchema } from './initPostgresSchema.js';
import { getPostgresPool } from './postgres.js';

export const bootstrapDatabases = async () => {
  await getPostgresPool().query('SELECT 1');
  await initPostgresSchema();
  await connectMongo();
};
