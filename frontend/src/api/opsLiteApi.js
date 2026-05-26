import { apiGet } from './client.js';

export const getOpsLiteSummary = () => apiGet('/ops-lite/summary');
