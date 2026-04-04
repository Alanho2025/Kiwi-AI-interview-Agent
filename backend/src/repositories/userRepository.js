import { query } from '../db/postgres.js';

const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  auth_provider: row.auth_provider,
  google_sub: row.google_sub,
  account_status: row.account_status,
});

export const findActiveUserByEmail = async (email) => {
  const result = await query(
    'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
    [email]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

export const findActiveUserById = async (id) => {
  const result = await query(
    'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [String(id)]
  );

  return result.rows[0] ? mapUser(result.rows[0]) : null;
};

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

export const updateGoogleUserLogin = async ({ id, fullName, googleSub }) => {
  await query(
    `UPDATE users
     SET full_name = $2, google_sub = COALESCE($3, google_sub), last_login_at = now(), updated_at = now()
     WHERE id = $1`,
    [id, fullName, googleSub]
  );
};
