import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

let pool;

const getConnectionString = () => process.env.POSTGRES_URL || process.env.POSTGRESQL_URL;

const resolveSslConfig = (connectionString = '') => {
  if (!connectionString) {
    return undefined;
  }

  if (connectionString.includes('sslmode=require')) {
    return { rejectUnauthorized: false };
  }

  const sslEnabled = String(process.env.POSTGRES_SSL || '').toLowerCase();
  if (sslEnabled === 'true' || sslEnabled === '1') {
    return { rejectUnauthorized: false };
  }

  return undefined;
};

const createPool = () => {
  if (pool) {
    return pool;
  }

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('POSTGRES_URL is not configured');
  }

  pool = new Pool({
    connectionString,
    max: Number(process.env.POSTGRES_POOL_MAX || 10),
    idleTimeoutMillis: Number(process.env.POSTGRES_IDLE_TIMEOUT_MS || 30000),
    connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECTION_TIMEOUT_MS || 10000),
    ssl: resolveSslConfig(connectionString),
  });

  pool.on('error', (error) => {
    console.error('[Postgres] Unexpected pool error:', error.message);
  });

  return pool;
};

const shortenSql = (text = '') => String(text).replace(/\s+/g, ' ').trim().slice(0, 180);

export const getPostgresPool = () => createPool();

export const connectPostgres = async () => {
  const activePool = createPool();
  await activePool.query('SELECT 1');
  console.log('[Postgres] Connected');
  return activePool;
};

export const checkPostgresHealth = async () => {
  try {
    await createPool().query('SELECT 1');
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error.message,
    };
  }
};

export const query = async (text, params = []) => {
  const activePool = createPool();

  try {
    return await activePool.query(text, params);
  } catch (error) {
    const wrappedError = new Error(
      `[Postgres] Query failed (${shortenSql(text)}) with ${params.length} parameter(s): ${error.message}`,
    );
    wrappedError.cause = error;
    throw wrappedError;
  }
};

export const withTransaction = async (callback) => {
  const client = await createPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (rollbackError) {
      console.error('[Postgres] Rollback failed:', rollbackError.message);
    }
    throw error;
  } finally {
    client.release();
  }
};

export const closePostgres = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
    console.log('[Postgres] Disconnected');
  }
};
