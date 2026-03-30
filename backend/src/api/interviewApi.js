import { apiClient } from './client.js';

export const startInterview = (sessionId) => apiClient('/interview/start', { method: 'POST', body: { sessionId } });
export const replyInterview = (sessionId, answer) => apiClient('/interview/reply', { method: 'POST', body: { sessionId, answer } });
export const repeatQuestion = (sessionId) => apiClient('/interview/repeat', { method: 'POST', body: { sessionId } });
export const pauseInterview = (sessionId) => apiClient('/interview/pause', { method: 'POST', body: { sessionId } });
export const resumeInterview = (sessionId) => apiClient('/interview/resume', { method: 'POST', body: { sessionId } });
export const endInterview = (sessionId) => apiClient('/interview/end', { method: 'POST', body: { sessionId } });
