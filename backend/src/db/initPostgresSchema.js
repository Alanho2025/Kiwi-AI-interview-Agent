/**
 * File responsibility: Database module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: initPostgresSchema should define and share database setup or model behaviour in one place.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { query } from './postgres.js';
import { POSTGRES_SCHEMA_STATEMENTS } from '../config/postgresSchemaStatements.js';

/**
 * Purpose: Execute the main responsibility for initPostgresSchema.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const initPostgresSchema = async () => {
  for (const statement of POSTGRES_SCHEMA_STATEMENTS) {
    await query(statement);
  }
};

// Made with Bob
