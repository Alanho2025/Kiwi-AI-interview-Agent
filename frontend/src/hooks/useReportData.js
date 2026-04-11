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

import { useCallback, useEffect, useState } from 'react';
import { generateReport, getReport, qaReport } from '../api/reportApi.js';

/**
 * Purpose: Execute the main responsibility for buildStatus.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
const buildStatus = (variant, title, message) => ({ variant, title, message });

export function useReportData(sessionId) {
  const [reportData, setReportData] = useState(null);
  const [status, setStatus] = useState(buildStatus('info', 'Report', 'Generate a structured report for this session.'));
  const [loading, setLoading] = useState(false);

  const loadReport = useCallback(async () => {
    try {
      const data = await getReport(sessionId);
      setReportData(data);
      setStatus(buildStatus('success', 'Report loaded', `Status: ${data.latestStatus || 'ready'}`));
    } catch (error) {
      setReportData(null);
      setStatus(buildStatus('info', 'No report yet', error.message || 'Generate a report to view it here.'));
    }
  }, [sessionId]);

  useEffect(() => {
    loadReport();
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

  return {
    reportData,
    status,
    loading,
    handleGenerate,
    handleQa,
  };
}
