import { connectMongo, getLastMongoError } from './mongo.js';
import { initPostgresSchema } from './initPostgresSchema.js';
import { connectPostgres } from './postgres.js';

export const bootstrapPostgres = async () => {
  await connectPostgres();
  await initPostgresSchema();
  console.log('[Bootstrap] Postgres schema ready');
  return { ok: true };
};

export const bootstrapMongo = async ({ required = false } = {}) => {
  try {
    await connectMongo();
    console.log('[Bootstrap] Mongo ready');
    return { ok: true };
  } catch (error) {
    const message = error?.message || 'Unknown Mongo startup error';
    console.error(`[Bootstrap] Mongo failed: ${message}`);

    if (required) {
      throw error;
    }

    return {
      ok: false,
      message,
      error: getLastMongoError(),
      degraded: true,
    };
  }
};

export const bootstrapDatabases = async ({ mongoRequired = false } = {}) => {
  const postgres = await bootstrapPostgres();
  const mongo = await bootstrapMongo({ required: mongoRequired });
  return { postgres, mongo };
};
