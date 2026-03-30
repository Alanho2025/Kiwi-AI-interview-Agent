import { formatSuccess, formatError } from '../utils/responseFormatter.js';
import { getSessionById } from '../services/sessionService.js';

export const exportTranscript = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    const session = getSessionById(sessionId);
    if (!session) return res.status(404).json(formatError('Session not found', 'NOT_FOUND', 'Invalid session ID'));

    const transcriptText = session.transcript.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n\n');
    
    // In a real app, you might set headers to trigger a file download
    // res.setHeader('Content-disposition', 'attachment; filename=transcript.txt');
    // res.setHeader('Content-type', 'text/plain');
    // res.send(transcriptText);
    
    res.json(formatSuccess('Transcript exported', { transcriptText }));
  } catch (error) {
    next(error);
  }
};
