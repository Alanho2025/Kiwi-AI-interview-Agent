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
export const generateReportPDF = (report) => {
  const doc = new jsPDF();
  const r = report.report || {};
  const qa = report.qaResult || {};
  
  let yPos = 20;
  const lineHeight = 7;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;
  
  const addText = (text, fontSize = 10, isBold = false) => {
    if (yPos > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    
    const lines = doc.splitTextToSize(text, 170);
    lines.forEach(line => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }
      doc.text(line, margin, yPos);
      yPos += lineHeight;
    });
  };
  
  const addSection = (title, content) => {
    yPos += 3;
    addText(title, 12, true);
    yPos += 2;
    if (content) {
      addText(content, 10, false);
    }
  };
  
  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('KIWI AI INTERVIEW AGENT', margin, yPos);
  yPos += lineHeight;
  doc.text('INTERVIEW REPORT', margin, yPos);
  yPos += lineHeight + 5;
  
  // Metadata
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated: ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : new Date().toLocaleString()}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Session ID: ${report.sessionId}`, margin, yPos);
  yPos += lineHeight;
  doc.text(`Status: ${report.latestStatus || 'unknown'}`, margin, yPos);
  yPos += lineHeight + 5;
  
  // Candidate & Role
  if (r.candidateName || r.jobTitle) {
    addSection('CANDIDATE & ROLE', '');
    if (r.candidateName) addText(`Candidate: ${r.candidateName}`);
    if (r.jobTitle) addText(`Target Role: ${r.jobTitle}`);
  }
  
  // Summary
  if (r.summary) {
    addSection('EXECUTIVE SUMMARY', r.summary);
  }
  
  // Scores
  if (r.scores) {
    addSection('SCORES', '');
    if (r.scores.overall !== undefined) addText(`Overall Score: ${r.scores.overall.toFixed(2)}/100`);
    if (r.scores.macro !== undefined) addText(`Macro Score: ${r.scores.macro.toFixed(2)}/100`);
    if (r.scores.micro !== undefined) addText(`Micro Score: ${r.scores.micro.toFixed(2)}/100`);
    if (r.scores.requirements !== undefined) addText(`Requirements Score: ${r.scores.requirements.toFixed(2)}/100`);
    if (r.scores.evidenceStrength !== undefined) addText(`Evidence Strength: ${r.scores.evidenceStrength}/4`);
  }
  
  // Sections
  if (r.sections && r.sections.length > 0) {
    addSection('DETAILED ANALYSIS', '');
    r.sections.forEach((section, i) => {
      yPos += 2;
      addText(`${i + 1}. ${section.title || 'Section'}`, 11, true);
      if (section.content) {
        addText(section.content);
      }
    });
  }
  
  // Recommendations
  if (r.recommendations && r.recommendations.length > 0) {
    addSection('RECOMMENDATIONS', '');
    r.recommendations.forEach((rec, i) => {
      addText(`${i + 1}. ${rec}`);
    });
  }
  
  // Interview Metrics
  if (r.interviewMetrics) {
    addSection('INTERVIEW METRICS', '');
    const m = r.interviewMetrics;
    if (m.candidateTurnCount !== undefined) addText(`Candidate Turns: ${m.candidateTurnCount}`);
    if (m.interviewerQuestionCount !== undefined) addText(`Interviewer Questions: ${m.interviewerQuestionCount}`);
    if (m.plannedQuestionCount !== undefined) addText(`Planned Questions: ${m.plannedQuestionCount}`);
  }
  
  // Evidence Diagnostics
  if (r.evidenceDiagnostics) {
    addSection('EVIDENCE DIAGNOSTICS', '');
    const ed = r.evidenceDiagnostics;
    if (ed.averageStrength !== undefined) addText(`Average Strength: ${ed.averageStrength}/4`);
    if (ed.totals) {
      addText('Evidence Type Breakdown:');
      if (ed.totals.direct_past_experience !== undefined) addText(`  - Direct Past Experience: ${ed.totals.direct_past_experience}`);
      if (ed.totals.hypothetical_understanding !== undefined) addText(`  - Hypothetical Understanding: ${ed.totals.hypothetical_understanding}`);
      if (ed.totals.generic_filler !== undefined) addText(`  - Generic Filler: ${ed.totals.generic_filler}`);
    }
  }
  
  // QA Results
  if (qa && Object.keys(qa).length > 0) {
    addSection('QUALITY ASSURANCE', '');
    if (qa.coverage !== undefined) addText(`Coverage: ${qa.coverage}%`);
    if (qa.quality !== undefined) addText(`Quality: ${qa.quality}%`);
    if (qa.completeness !== undefined) addText(`Completeness: ${qa.completeness}%`);
  }
  
  return doc.output('blob');
};
