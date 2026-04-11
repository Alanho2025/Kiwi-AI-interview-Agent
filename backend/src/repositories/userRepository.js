/**
 * File responsibility: Repository / data access module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: userRepository should centralise data access queries so schema changes touch the fewest files possible.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { query } from '../db/postgres.js';

/**
 * Purpose: Execute the main responsibility for mapUser.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  auth_provider: row.auth_provider,
  google_sub: row.google_sub,
  account_status: row.account_status,
});

/**
 * Purpose: Execute the main responsibility for findActiveUserByEmail.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const findActiveUserByEmail = async (email) => {
  const result = await query(
    'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
    [email]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

/**
 * Purpose: Execute the main responsibility for findActiveUserById.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const findActiveUserById = async (id) => {
  const result = await query(
    'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [String(id)]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

/**
 * Purpose: Execute the main responsibility for createGoogleUser.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const createGoogleUser = async ({ id, email, fullName, googleSub }) => {
  await query(
    `INSERT INTO users (
      id, email, full_name, auth_provider, google_sub, account_status, last_login_at, created_at, updated_at
    ) VALUES ($1,$2,$3,'google',$4,'active',now(),now(),now())`,
    [id, email, fullName, googleSub]
  );

  return {
    id,
    email,
    full_name: fullName,
    auth_provider: 'google',
    google_sub: googleSub,
    account_status: 'active',
  };
};

/**
 * Purpose: Execute the main responsibility for updateGoogleUserLogin.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const updateGoogleUserLogin = async ({ id, fullName, googleSub }) => {
  await query(
    `UPDATE users
     SET full_name = $2, google_sub = COALESCE($3, google_sub), last_login_at = now(), updated_at = now()
     WHERE id = $1`,
    [id, fullName, googleSub]
  );
};
