import crypto from 'crypto';
import { query } from '../db/postgres.js';

const mapUser = (row) => ({
  id: row.id,
  email: row.email,
  full_name: row.full_name,
  auth_provider: row.auth_provider,
  google_sub: row.google_sub,
  account_status: row.account_status,
});

export const findOrCreateGoogleUser = async (email, name, googleSub = null) => {
  const normalizedEmail = email.trim().toLowerCase();
  const existing = await query(
    'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
    [normalizedEmail]
  );

  if (existing.rows[0]) {
    const current = existing.rows[0];
    const fullName = name?.trim() || current.full_name;
    await query(
      `UPDATE users
       SET full_name = $2, google_sub = COALESCE($3, google_sub), last_login_at = now(), updated_at = now()
       WHERE id = $1`,
      [current.id, fullName, googleSub]
    );
    return {
      ...mapUser(current),
      full_name: fullName,
      google_sub: googleSub || current.google_sub,
    };
  }

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO users (
      id, email, full_name, auth_provider, google_sub, account_status, last_login_at, created_at, updated_at
    ) VALUES ($1,$2,$3,'google',$4,'active',now(),now(),now())`,
    [id, normalizedEmail, name?.trim() || normalizedEmail, googleSub]
  );

  return {
    id,
    email: normalizedEmail,
    full_name: name?.trim() || normalizedEmail,
    auth_provider: 'google',
    google_sub: googleSub,
  };
};

export const getUserById = async (id) => {
  const result = await query(
    'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
    [String(id)]
  );

  if (!result.rows[0]) {
    throw new Error('User not found');
  }

  return mapUser(result.rows[0]);
};

export const resolveUserFromRequest = async (req) => {
  if (req.user?.id) {
    return getUserById(req.user.id);
  }

  throw new Error('Authentication required');
};
