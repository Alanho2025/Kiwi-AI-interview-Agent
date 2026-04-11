/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: bootstrap should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { connectMongo, getLastMongoError } from './mongo.js';
import { initPostgresSchema } from './initPostgresSchema.js';
import { connectPostgres } from './postgres.js';

/**
 * Purpose: Execute the main responsibility for bootstrapPostgres.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const bootstrapPostgres = async () => {
  await connectPostgres();
  await initPostgresSchema();
  console.log('[Bootstrap] Postgres schema ready');
  return { ok: true };
};

/**
 * Purpose: Execute the main responsibility for bootstrapMongo.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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

/**
 * Purpose: Execute the main responsibility for bootstrapDatabases.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const bootstrapDatabases = async ({ mongoRequired = false } = {}) => {
  const postgres = await bootstrapPostgres();
  const mongo = await bootstrapMongo({ required: mongoRequired });
  return { postgres, mongo };
};
