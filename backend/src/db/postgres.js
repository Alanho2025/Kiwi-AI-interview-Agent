import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

let pool;

const createPool = () => {
  if (pool) {
    return pool;
  }

  const connectionString = process.env.POSTGRES_URL || process.env.POSTGRESQL_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL is not configured');
  }

  pool = new Pool({
    connectionString,
    ssl: connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  });

  return pool;
};

export const getPostgresPool = () => createPool();

export const query = async (text, params = []) => {
  const activePool = createPool();
  return activePool.query(text, params);
};

export const withTransaction = async (callback) => {
  const client = await createPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const closePostgres = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};
