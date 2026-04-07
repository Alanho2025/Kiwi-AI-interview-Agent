import { apiPost, apiGet } from './client.js';

export const generateReport = async ({ sessionId }) => apiPost('/report/generate', { sessionId });
export const qaReport = async ({ sessionId }) => apiPost('/report/qa', { sessionId });
export const getReport = async (sessionId) => apiGet(`/report/${sessionId}`);
