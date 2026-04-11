/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: auditService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import crypto from 'crypto';
import { query } from '../db/postgres.js';

/**
 * Purpose: Execute the main responsibility for createAuditLog.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
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
