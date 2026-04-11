/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: interviewAuditService should encapsulate domain behaviour behind small callable functions with predictable inputs and outputs.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { createAuditLog } from '../auditService.js';

/**
 * Purpose: Execute the main responsibility for createInterviewLifecycleAuditLog.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const createInterviewLifecycleAuditLog = async ({ req, session, actionType }) => {
  await createAuditLog({
    actorUserId: session.userId,
    targetUserId: session.userId,
    sessionId: session.id,
    actionType,
    resourceType: 'interview_session',
    resourceId: session.id,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });
};
