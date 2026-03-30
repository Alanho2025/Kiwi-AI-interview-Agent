import { apiClient } from './client.js';

export const saveSession = (sessionId, data) => apiClient('/session/save', { method: 'POST', body: { sessionId, data } });
export const getSession = (sessionId) => apiClient(`/session/${sessionId}`);
export const resumeSession = (sessionId) => apiClient('/session/resume', { method: 'POST', body: { sessionId } });
