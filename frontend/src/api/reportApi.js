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

/**
 * Purpose: Execute the main responsibility for generateReport.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export const generateReport = async ({ sessionId }) => apiPost('/report/generate', { sessionId });
export const qaReport = async ({ sessionId }) => apiPost('/report/qa', { sessionId });
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

/**
 * Purpose: Generate PDF from report data.
 * Inputs: Report object from MongoDB.
 * Returns: PDF blob.
 */
export const generateReportPDF = async (report) => {
  try {
    const element = document.getElementById('report-printable-area');
    if (!element) {
      throw new Error('Report content not found in DOM');
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      throw new Error('Please allow popups to generate PDF');
    }

    const styleElements = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\\n');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Interview Report - ${report.candidateName || 'Candidate'}</title>
          ${styleElements}
          <style>
            @media print {
              body { 
                padding: 0; 
                margin: 0;
                background-color: white !important;
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
              }
              .no-print { display: none !important; }
              @page { margin: 1cm; }
            }
            body {
              padding: 20px;
            }
          </style>
        </head>
        <body>
          ${element.outerHTML}
          <script>
            // Wait for styles to load before printing
            window.onload = () => {
              setTimeout(() => {
                window.print();
                window.close();
              }, 250);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    return null;
  } catch (error) {
    console.error('Failed to trigger print dialog:', error);
    throw new Error('Could not open print dialog. ' + error.message);
  }
};
