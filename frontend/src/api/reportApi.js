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
import { jsPDF } from 'jspdf';

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
    // Use dynamic import so the app doesn't crash if html2canvas isn't installed yet
    const html2canvasModule = await import('html2canvas');
    const html2canvas = html2canvasModule.default ? html2canvasModule.default : html2canvasModule;
    
    const element = document.getElementById('report-printable-area');
    if (!element) {
      throw new Error('Report content not found in DOM');
    }

    // Temporarily ensure white background
    const originalBg = element.style.backgroundColor;
    element.style.backgroundColor = '#ffffff';

    const canvas = await html2canvas(element, {
      scale: 2, 
      useCORS: true,
      logging: false,
      windowWidth: 1000 // Force a desktop-like width for the screenshot
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'pt',
      format: 'a4'
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    const pageHeightPt = pdf.internal.pageSize.getHeight();

    let heightLeft = pdfHeight;
    let position = 0;
    
    // Page 1
    pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
    heightLeft -= pageHeightPt;

    // Remaining pages
    while (heightLeft > 0) {
      // Move the image up by the page height to show the next chunk
      position -= pageHeightPt;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeightPt;
    }

    // Restore background color
    element.style.backgroundColor = originalBg;

    return pdf.output('blob');
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    throw new Error('Could not generate PDF from the webpage. Please make sure html2canvas is installed.');
  }
};
