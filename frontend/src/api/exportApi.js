import { apiClient } from './client.js';

export const exportTranscript = (sessionId) =>
  apiClient('/export/transcript', { method: 'POST', body: { sessionId } });
