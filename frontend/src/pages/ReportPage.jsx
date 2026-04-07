import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '../components/layout/AppHeader.jsx';
import { Card, CardContent, CardHeader, CardTitle } from '../components/common/Card.jsx';
import { Button } from '../components/common/Button.jsx';
import { StatusBanner } from '../components/common/StatusBanner.jsx';
import { generateReport, getReport, qaReport } from '../api/reportApi.js';

export function ReportPage() {
  const { sessionId } = useParams();
  const [reportData, setReportData] = useState(null);
  const [status, setStatus] = useState({ variant: 'info', title: 'Report', message: 'Generate a structured report for this session.' });
  const [loading, setLoading] = useState(false);

  const loadReport = async () => {
    try {
      const data = await getReport(sessionId);
      setReportData(data);
      setStatus({ variant: 'success', title: 'Report loaded', message: `Status: ${data.latestStatus || 'ready'}` });
    } catch (error) {
      setReportData(null);
      setStatus({ variant: 'info', title: 'No report yet', message: error.message || 'Generate a report to view it here.' });
    }
  };

  useEffect(() => {
    loadReport();
  }, [sessionId]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const data = await generateReport({ sessionId });
      setReportData(data.stored || data);
      setStatus({ variant: 'success', title: 'Report generated', message: 'A new structured report is ready.' });
      await loadReport();
    } catch (error) {
      setStatus({ variant: 'error', title: 'Generation failed', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleQa = async () => {
    setLoading(true);
    try {
      await qaReport({ sessionId });
      setStatus({ variant: 'success', title: 'QA completed', message: 'Report QA flags were refreshed.' });
      await loadReport();
    } catch (error) {
      setStatus({ variant: 'error', title: 'QA failed', message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const report = reportData?.report || {};
  const qa = reportData?.qaResult || {};
  const interviewMetrics = report.interviewMetrics || {};
  const evidenceDiagnostics = report.evidenceDiagnostics || {};
  const qaDiagnostics = qa.diagnostics || {};

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader />
      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <StatusBanner {...status} />
        <div className="flex gap-3">
          <Button onClick={handleGenerate} disabled={loading}>{loading ? 'Working...' : 'Generate report'}</Button>
          <Button onClick={handleQa} variant="secondary" disabled={loading}>Run QA</Button>
        </div>

        <Card>
          <CardHeader><CardTitle>Report summary</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">{report.summary || 'No report generated yet.'}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Overall: {report.scores?.overall ?? '-'}</div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Macro: {report.scores?.macro ?? '-'}</div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Micro: {report.scores?.micro ?? '-'}</div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Requirements: {report.scores?.requirements ?? '-'}</div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Evidence strength: {report.scores?.evidenceStrength ?? '-'}</div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Direct evidence turns: {report.scores?.directEvidenceTurns ?? '-'}</div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Hypothetical turns: {report.scores?.hypotheticalTurns ?? '-'}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Interview metrics</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Planned questions: {interviewMetrics.plannedQuestionCount ?? '-'}</div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Scored questions: {interviewMetrics.interviewerQuestionCount ?? '-'}</div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Candidate turns: {interviewMetrics.candidateTurnCount ?? '-'}</div>
              <div className="rounded-xl bg-gray-50 p-4 text-sm">Extra AI turns: {interviewMetrics.extraAiTurnCount ?? '-'}</div>
            </div>
            <p className="mt-3 text-sm text-gray-700">Interview completed by limit: {interviewMetrics.interviewCompletedByLimit ? 'Yes' : 'No'}</p>
            <p className="mt-2 text-sm text-gray-700">Average evidence strength: {evidenceDiagnostics.averageStrength ?? '-'}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Sections</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(report.sections || []).map((section) => (
                <div key={section.id} className="rounded-xl border border-gray-100 p-4">
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  <p className="mt-2 text-sm text-gray-700">{section.content}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>QA result</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-gray-700">Coverage score: {qa.coverageScore ?? '-'} | Hallucination risk: {qa.hallucinationRisk || '-'}</p>
            <p className="mt-2 text-sm text-gray-700">Passed: {qa.passed ? 'Yes' : 'No'}</p>
            <p className="mt-2 text-sm text-gray-700">QA question alignment: {qaDiagnostics.interviewerQuestionCount ?? '-'} / {qaDiagnostics.plannedQuestionCount ?? '-'} | Avg evidence strength: {qaDiagnostics.averageEvidenceStrength ?? '-'}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(qa.qualityFlags || []).map((flag) => <span key={flag} className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">{flag}</span>)}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
