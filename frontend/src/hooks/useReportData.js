/**
 * File responsibility: Custom React hook.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: useReportData should manage state transitions, side effects, and derived values while keeping UI files thin.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { generateReport, getReport, qaReport, exportReport, downloadReportFile, generateReportPDF } from '../api/reportApi.js';

const buildStatus = (variant, title, message) => ({ variant, title, message });

const isMissingReportError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('report not found') || message.includes('no report exists');
};

/**
 * Purpose: Format report as readable text (mirrors backend function).
 * Inputs: Report object from MongoDB.
 * Returns: Formatted text string.
 */
const formatReportAsText = (report) => {
  const lines = [];
  const r = report.report || {};
  const qa = report.qaResult || {};
  
  lines.push('KIWI AI INTERVIEW AGENT - INTERVIEW REPORT');
  lines.push('==========================================');
  lines.push(`Generated: ${r.generatedAt ? new Date(r.generatedAt).toLocaleString() : new Date().toLocaleString()}`);
  lines.push(`Session ID: ${report.sessionId}`);
  lines.push(`Report Status: ${report.latestStatus || 'unknown'}`);
  lines.push(`Schema Version: ${r.schemaVersion || 'unknown'}`);
  lines.push('');
  
  // Candidate & Role Information
  if (r.candidateName || r.jobTitle) {
    lines.push('CANDIDATE & ROLE');
    lines.push('================');
    if (r.candidateName) lines.push(`Candidate: ${r.candidateName}`);
    if (r.jobTitle) lines.push(`Target Role: ${r.jobTitle}`);
    lines.push('');
  }
  
  // Summary
  if (r.summary) {
    lines.push('EXECUTIVE SUMMARY');
    lines.push('=================');
    lines.push(r.summary);
    lines.push('');
  }
  
  // Scores
  if (r.scores) {
    lines.push('SCORES');
    lines.push('======');
    if (r.scores.overall !== undefined) lines.push(`Overall Score: ${r.scores.overall.toFixed(2)}/100`);
    if (r.scores.macro !== undefined) lines.push(`Macro Score: ${r.scores.macro.toFixed(2)}/100`);
    if (r.scores.micro !== undefined) lines.push(`Micro Score: ${r.scores.micro.toFixed(2)}/100`);
    if (r.scores.requirements !== undefined) lines.push(`Requirements Score: ${r.scores.requirements.toFixed(2)}/100`);
    if (r.scores.evidenceStrength !== undefined) lines.push(`Evidence Strength: ${r.scores.evidenceStrength}/4`);
    if (r.scores.directEvidenceTurns !== undefined) lines.push(`Direct Evidence Turns: ${r.scores.directEvidenceTurns}`);
    if (r.scores.hypotheticalTurns !== undefined) lines.push(`Hypothetical Turns: ${r.scores.hypotheticalTurns}`);
    lines.push('');
  }
  
  // Sections (detailed content)
  if (r.sections && r.sections.length > 0) {
    lines.push('DETAILED ANALYSIS');
    lines.push('=================');
    lines.push('');
    r.sections.forEach((section, i) => {
      lines.push(`${i + 1}. ${section.title || 'Section'}`);
      lines.push('-'.repeat(section.title ? section.title.length + 3 : 10));
      if (section.content) {
        lines.push(section.content);
      }
      lines.push('');
    });
  }
  
  // Recommendations
  if (r.recommendations && r.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    lines.push('===============');
    r.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }
  
  // Interview Metrics
  if (r.interviewMetrics) {
    lines.push('INTERVIEW METRICS');
    lines.push('=================');
    const m = r.interviewMetrics;
    if (m.candidateTurnCount !== undefined) lines.push(`Candidate Turns: ${m.candidateTurnCount}`);
    if (m.interviewerQuestionCount !== undefined) lines.push(`Interviewer Questions: ${m.interviewerQuestionCount}`);
    if (m.plannedQuestionCount !== undefined) lines.push(`Planned Questions: ${m.plannedQuestionCount}`);
    if (m.extraAiTurnCount !== undefined) lines.push(`Extra AI Turns: ${m.extraAiTurnCount}`);
    if (m.interviewCompletedByLimit !== undefined) lines.push(`Completed by Limit: ${m.interviewCompletedByLimit ? 'Yes' : 'No'}`);
    lines.push('');
  }
  
  // Evidence Diagnostics
  if (r.evidenceDiagnostics) {
    lines.push('EVIDENCE DIAGNOSTICS');
    lines.push('====================');
    const ed = r.evidenceDiagnostics;
    if (ed.averageStrength !== undefined) lines.push(`Average Strength: ${ed.averageStrength}/4`);
    if (ed.totals) {
      lines.push('Evidence Type Breakdown:');
      if (ed.totals.direct_past_experience !== undefined) lines.push(`  - Direct Past Experience: ${ed.totals.direct_past_experience}`);
      if (ed.totals.adjacent_experience !== undefined) lines.push(`  - Adjacent Experience: ${ed.totals.adjacent_experience}`);
      if (ed.totals.hypothetical_understanding !== undefined) lines.push(`  - Hypothetical Understanding: ${ed.totals.hypothetical_understanding}`);
      if (ed.totals.generic_filler !== undefined) lines.push(`  - Generic Filler: ${ed.totals.generic_filler}`);
    }
    lines.push('');
  }
  
  // QA Results
  if (qa && Object.keys(qa).length > 0) {
    lines.push('QUALITY ASSURANCE');
    lines.push('=================');
    if (qa.coverage !== undefined) lines.push(`Coverage: ${qa.coverage}%`);
    if (qa.quality !== undefined) lines.push(`Quality: ${qa.quality}%`);
    if (qa.completeness !== undefined) lines.push(`Completeness: ${qa.completeness}%`);
    if (qa.notes && qa.notes.length > 0) {
      lines.push('QA Notes:');
      qa.notes.forEach((note, i) => {
        lines.push(`  ${i + 1}. ${note}`);
      });
    }
    if (qa.flags && qa.flags.length > 0) {
      lines.push('QA Flags:');
      qa.flags.forEach((flag, i) => {
        lines.push(`  ${i + 1}. ${flag}`);
      });
    }
    lines.push('');
  }
  
  lines.push('END OF REPORT');
  lines.push('=============');
  
  return lines.join('\n');
};

export function useReportData(sessionId) {
  const [reportData, setReportData] = useState(null);
  const [status, setStatus] = useState(buildStatus('info', 'Report', 'Generate a structured report for this session.'));
  const [loading, setLoading] = useState(false);
  const hasAutoGeneratedRef = useRef(false);

  const loadReport = useCallback(async ({ autoGenerateIfMissing = false } = {}) => {
    try {
      const data = await getReport(sessionId);
      setReportData(data);
      setStatus(buildStatus('success', 'Report loaded', `Status: ${data.latestStatus || 'ready'}`));
      return data;
    } catch (error) {
      if (autoGenerateIfMissing && !hasAutoGeneratedRef.current && isMissingReportError(error)) {
        hasAutoGeneratedRef.current = true;
        setStatus(buildStatus('info', 'Generating report', 'No saved report was found, so a fresh one is being generated now.'));
        await generateReport({ sessionId });
        return loadReport({ autoGenerateIfMissing: false });
      }

      setReportData(null);
      setStatus(buildStatus('info', 'No report yet', error.message || 'Generate a report to view it here.'));
      return null;
    }
  }, [sessionId]);

  useEffect(() => {
    setLoading(true);
    loadReport({ autoGenerateIfMissing: true })
      .finally(() => setLoading(false));
  }, [loadReport]);

  const runReportAction = useCallback(async ({ action, successStatus, failureTitle }) => {
    setLoading(true);
    try {
      const result = await action();
      if (result?.stored || result?.report || result?.qaResult) {
        setReportData(result.stored || result);
      }
      setStatus(successStatus);
      await loadReport();
    } catch (error) {
      setStatus(buildStatus('error', failureTitle, error.message || 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  }, [loadReport]);

  const handleGenerate = useCallback(() => runReportAction({
    action: () => generateReport({ sessionId }),
    successStatus: buildStatus('success', 'Report generated', 'A new structured report is ready.'),
    failureTitle: 'Generation failed',
  }), [runReportAction, sessionId]);

  const handleQa = useCallback(() => runReportAction({
    action: () => qaReport({ sessionId }),
    successStatus: buildStatus('success', 'QA completed', 'Report QA flags were refreshed.'),
    failureTitle: 'QA failed',
  }), [runReportAction, sessionId]);

  const handleExport = useCallback(async (format = 'json') => {
    setLoading(true);
    try {
      // For PDF, we don't need to call the backend API
      if (format === 'pdf') {
        if (reportData) {
          await generateReportPDF(reportData);
          setStatus(buildStatus('success', 'Report exported', 'Report downloaded as PDF file.'));
        } else {
          setStatus(buildStatus('error', 'Export failed', 'No report data available to export.'));
        }
      } else {
        // For JSON and TXT, call backend API
        const result = await exportReport({ sessionId, format });
        if (reportData) {
          const content = format === 'json' 
            ? JSON.stringify(reportData, null, 2)
            : formatReportAsText(reportData);
          downloadReportFile({ content, sessionId, format });
          setStatus(buildStatus('success', 'Report exported', `Report downloaded as ${format.toUpperCase()} file.`));
        } else {
          setStatus(buildStatus('error', 'Export failed', 'No report data available to export.'));
        }
      }
    } catch (error) {
      setStatus(buildStatus('error', 'Export failed', error.message || 'Could not export the report.'));
    } finally {
      setLoading(false);
    }
  }, [sessionId, reportData]);

  return {
    reportData,
    status,
    loading,
    handleGenerate,
    handleQa,
    handleExport,
  };
}
