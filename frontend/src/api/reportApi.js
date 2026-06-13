/**
 * File responsibility: Application module.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: reportApi should keep its module boundaries clear and focused.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { apiPost, apiGet } from './client.js';
import { generateReportPDF } from '../utils/reportPdf/reportPdfTemplate.js';

/**
 * Purpose: Execute the main responsibility for generateReport.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const generateReport = async ({ sessionId }) => apiPost('/report/generate', { sessionId });
export const qaReport = async ({ sessionId, userPrompt = '' }) => apiPost('/report/qa', { sessionId, userPrompt });
export const qaReportCheckOnly = async ({ sessionId }) => apiPost('/report/qa-check', { sessionId });
export const getReport = async (sessionId) => apiGet(`/report/${sessionId}`);

/**
 * Purpose: Execute the main responsibility for exportReport.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const exportReport = async ({ sessionId, format = 'json' }) => 
  apiPost(`/report/${sessionId}/export`, { format });

/**
 * Purpose: Download report file using blob URL.
 * Inputs: File content and session ID.
 * Returns: None, triggers browser download.
 */
export const downloadReportFile = ({ content, sessionId, format = 'json' }) => {
  const extension = format === 'json' ? 'json' : (format === 'pdf' ? 'pdf' : 'txt');
  const mimeType = format === 'json' ? 'application/json' : (format === 'pdf' ? 'application/pdf' : 'text/plain');
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `report-${sessionId}.${extension}`;
  anchor.click();
  URL.revokeObjectURL(url);
};

export { generateReportPDF };
