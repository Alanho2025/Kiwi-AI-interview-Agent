/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: postgres should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

let pool;

/**
 * Purpose: Execute the main responsibility for getConnectionString.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for createPool.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for shortenSql.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const shortenSql = (text = '') => String(text).replace(/\s+/g, ' ').trim().slice(0, 180);

export const getPostgresPool = () => createPool();

/**
 * Purpose: Execute the main responsibility for connectPostgres.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const connectPostgres = async () => {
  const activePool = createPool();
  await activePool.query('SELECT 1');
  console.log('[Postgres] Connected');
  return activePool;
};

/**
 * Purpose: Execute the main responsibility for checkPostgresHealth.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for query.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for withTransaction.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for closePostgres.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const closePostgres = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
    console.log('[Postgres] Disconnected');
  }
};
