import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { getSessionById } from '../services/sessionService.js';
import { saveTextToLocalStorage } from '../services/storageService.js';
import { createUploadedFileRecord } from '../services/fileRepositoryService.js';
import { createAuditLog } from '../services/auditService.js';

export const exportTranscript = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = await getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    const transcriptText = session.transcript.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n\n');
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
    
    // In a real app, you might set headers to trigger a file download
    // res.setHeader('Content-disposition', 'attachment; filename=transcript.txt');
    // res.setHeader('Content-type', 'text/plain');
    // res.send(transcriptText);
    
    res.json(formatSuccess('Transcript exported', { transcriptText, exportFileId }));
  } catch (error) {
    next(error);
  }
};
