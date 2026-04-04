import crypto from 'crypto';
import { query } from '../db/postgres.js';

export const createAuditLog = async ({
  actorUserId = null,
  targetUserId = null,
  sessionId = null,
  actionType,
  resourceType,
  resourceId,
  status = 'success',
  ipAddress = null,
  userAgent = null,
  metadata = {},
}) => {
  await query(
    `INSERT INTO audit_logs (
      id, actor_user_id, target_user_id, session_id, action_type, resource_type,
      resource_id, status, ip_address, user_agent, metadata, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb,now())`,
    [
      crypto.randomUUID(),
      actorUserId,
      targetUserId,
      sessionId,
      actionType,
      resourceType,
      resourceId,
      status,
      ipAddress,
      userAgent,
      JSON.stringify(metadata),
    ]
  );
};
