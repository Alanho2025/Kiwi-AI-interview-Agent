/**
 * File responsibility: HTTP controller.
 * Main responsibilities:
 * - Keep HTTP, business logic, persistence, and formatting concerns separated to reduce change impact.
 * - Main file role: exportController should handle request/response orchestration and delegate actual work to services.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { formatSuccess } from '../utils/responseFormatter.js';
import { getOwnedSessionById } from '../services/sessionService.js';
import { saveTextToLocalStorage } from '../services/storageService.js';
import { createUploadedFileRecord } from '../services/fileRepositoryService.js';
import { createAuditLog } from '../services/auditService.js';
import { resolveUserFromRequest } from '../services/authService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { badRequest, notFound } from '../utils/appError.js';
import { logger, getRequestLogMeta } from '../utils/logger.js';

export const exportTranscript = asyncHandler(async (req, res) => {
  const { sessionId } = req.body;
  if (!sessionId) {
    throw badRequest('Missing sessionId', 'sessionId is required');
  }

  const user = await resolveUserFromRequest(req);
  const session = await getOwnedSessionById(sessionId, user.id);
  if (!session) {
    throw notFound('Session not found or access denied', 'Invalid session ID or you do not have permission to export this session');
  }

  const transcriptText = session.transcript.map((message) => `${message.role.toUpperCase()}: ${message.text}`).join('\n\n');
  const storage = await saveTextToLocalStorage({
    text: transcriptText,
    suggestedFilename: `transcript-${sessionId}.txt`,
    folder: 'exports',
  });
  const exportFileId = await createUploadedFileRecord({
    userId: session.userId,
    sessionId,
    fileRole: 'transcript_export',
    originalFilename: `transcript-${sessionId}.txt`,
    mimeType: 'text/plain',
    storageProvider: storage.storageProvider,
    storageKey: storage.storageKey,
    fileSizeBytes: Buffer.byteLength(transcriptText, 'utf8'),
  });
  await createAuditLog({
    actorUserId: session.userId,
    targetUserId: session.userId,
    sessionId,
    actionType: 'export_transcript',
    resourceType: 'uploaded_file',
    resourceId: exportFileId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  });

  logger.info('Transcript exported', getRequestLogMeta(req, { exportFileId }));
  res.json(formatSuccess('Transcript exported', { transcriptText, exportFileId }));
});
