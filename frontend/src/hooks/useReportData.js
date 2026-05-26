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
import { downloadSessionRecording, getSessionRecordingStatus } from '../api/recordingApi.js';

const buildStatus = (variant, title, message) => ({ variant, title, message });

const isMissingReportError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return message.includes('report not found') || message.includes('no report exists');
};

const EXPORT_AUDIT_TIMEOUT_MS = 6000;

/**
 * Purpose: Bound non-critical export audit calls so browser downloads never look frozen.
 * Inputs: A promise and timeout metadata.
 * Returns: The promise result, or throws a timeout error.
 */
const withTimeout = (promise, timeoutMs, timeoutMessage) => {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
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
  
  if (r.candidateName || r.jobTitle) {
    lines.push('CANDIDATE & ROLE');
    lines.push('================');
    if (r.candidateName) lines.push(`Candidate: ${r.candidateName}`);
    if (r.jobTitle) lines.push(`Target Role: ${r.jobTitle}`);
    lines.push('');
  }
  
  if (r.summary) {
    lines.push('EXECUTIVE SUMMARY');
    lines.push('=================');
    lines.push(r.summary);
    lines.push('');
  }
  
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
  
  if (r.recommendations && r.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS');
    lines.push('===============');
    r.recommendations.forEach((rec, i) => {
      lines.push(`${i + 1}. ${rec}`);
    });
    lines.push('');
  }
  
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
  const [recordingStatus, setRecordingStatus] = useState({ state: 'checking', available: false, error: null });
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

  useEffect(() => {
    let cancelled = false;

    const loadRecordingStatus = async () => {
      setRecordingStatus({ state: 'checking', available: false, error: null });
      try {
        const result = await getSessionRecordingStatus(sessionId);
        if (cancelled) return;
        setRecordingStatus({
          state: result?.available ? 'ready' : 'missing',
          available: Boolean(result?.available),
          error: null,
        });
      } catch (error) {
        if (cancelled) return;
        setRecordingStatus({
          state: 'failed',
          available: false,
          error: error.message || 'Could not check MP3 recording status.',
        });
      }
    };

    loadRecordingStatus();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  const runReportAction = useCallback(async ({ action, successStatus, failureTitle }) => {
    setLoading(true);
    try {
      const result = await action();
      if (result?.stored || result?.report || result?.qaResult) {
        setReportData(result.stored || result);
      }
      setStatus(successStatus(result));
      await loadReport();
    } catch (error) {
      setStatus(buildStatus('error', failureTitle, error.message || 'Something went wrong.'));
    } finally {
      setLoading(false);
    }
  }, [loadReport]);

  const handleGenerate = useCallback(() => runReportAction({
    action: () => generateReport({ sessionId }),
    successStatus: () => buildStatus('success', 'Report generated', 'A new structured report is ready.'),
    failureTitle: 'Generation failed',
  }), [runReportAction, sessionId]);

  const handleQa = useCallback((userPrompt = '') => runReportAction({
    action: () => qaReport({ sessionId, userPrompt }),
    successStatus: (result = {}) => buildStatus(
      'success',
      result.rewriteApplied ? 'QA rewrite completed' : 'QA completed',
      result.rewriteApplied ? 'The report was rewritten with your prompt and QA was refreshed.' : 'Report QA flags were refreshed.'
    ),
    failureTitle: 'QA failed',
  }), [runReportAction, sessionId]);

  const handleExport = useCallback(async (format = 'json') => {
    setLoading(true);
    setStatus(buildStatus('info', 'Preparing export', `Preparing ${String(format).toUpperCase()} download...`));

    try {
      if (!reportData) {
        setStatus(buildStatus('error', 'Export failed', 'No report data available to export.'));
        return;
      }

      if (format === 'pdf') {
        await generateReportPDF(reportData);
        setStatus(buildStatus('success', 'Report exported', 'Report downloaded as PDF file.'));
        return;
      }

      const content = format === 'json'
        ? JSON.stringify(reportData, null, 2)
        : formatReportAsText(reportData);

      downloadReportFile({ content, sessionId, format });

      try {
        await withTimeout(
          exportReport({ sessionId, format }),
          EXPORT_AUDIT_TIMEOUT_MS,
          'Export audit timed out. The file was downloaded, but the server did not confirm the export record.'
        );
        setStatus(buildStatus('success', 'Report exported', `Report downloaded as ${format.toUpperCase()} file.`));
      } catch (auditError) {
        setStatus(buildStatus(
          'info',
          'Report downloaded',
          auditError.message || 'The file was downloaded, but the server export record could not be saved.'
        ));
      }
    } catch (error) {
      setStatus(buildStatus('error', 'Export failed', error.message || 'Could not export the report.'));
    } finally {
      setLoading(false);
    }
  }, [sessionId, reportData]);


  const handleDownloadRecording = useCallback(async () => {
    setLoading(true);
    try {
      await downloadSessionRecording(sessionId);
      setStatus(buildStatus('success', 'MP3 downloaded', 'Voice recording downloaded as an MP3 file.'));
    } catch (error) {
      setStatus(buildStatus('error', 'MP3 download failed', error.message || 'No MP3 recording is available for this session yet.'));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  return {
    reportData,
    status,
    loading,
    handleGenerate,
    handleQa,
    handleExport,
    handleDownloadRecording,
    recordingStatus,
  };
}
