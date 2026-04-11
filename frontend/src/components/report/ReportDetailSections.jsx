/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: ReportDetailSections should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';
import { formatNumber, titleCase } from '../../utils/reportViewBuilder.js';

/**
 * Purpose: Execute the main responsibility for ReportDetailSections.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function ReportDetailSections({ report, qa, interviewMetrics, evidenceDiagnostics, qaDiagnostics }) {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Section-by-Section Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(report.sections || []).map((section) => (
              <div key={section.id} className="rounded-2xl border border-gray-100 p-4">
                <h3 className="text-base font-semibold text-gray-900">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-gray-700">{section.content}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <details className="group rounded-2xl border border-gray-200 bg-white shadow-sm">
        <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Detailed Metrics</h2>
            <p className="mt-1 text-sm text-gray-600">For users who want the raw numbers behind the feedback.</p>
          </div>
          <span className="text-sm font-medium text-gray-500 group-open:hidden">Show details</span>
          <span className="hidden text-sm font-medium text-gray-500 group-open:block">Hide details</span>
        </summary>
        <div className="border-t border-gray-100 p-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">Scores</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Overall: {formatNumber(report.scores?.overall)}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Macro: {formatNumber(report.scores?.macro)}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Micro: {formatNumber(report.scores?.micro)}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Requirements: {formatNumber(report.scores?.requirements)}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Evidence strength: {formatNumber(report.scores?.evidenceStrength)}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Direct evidence turns: {report.scores?.directEvidenceTurns ?? '-'}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Hypothetical turns: {report.scores?.hypotheticalTurns ?? '-'}</div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-gray-500">Interview metrics</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Planned questions: {interviewMetrics.plannedQuestionCount ?? '-'}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Scored questions: {interviewMetrics.interviewerQuestionCount ?? '-'}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Candidate turns: {interviewMetrics.candidateTurnCount ?? '-'}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Extra AI turns: {interviewMetrics.extraAiTurnCount ?? '-'}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Completed by limit: {interviewMetrics.interviewCompletedByLimit ? 'Yes' : 'No'}</div>
                <div className="rounded-xl bg-gray-50 p-4 text-sm">Average evidence strength: {formatNumber(evidenceDiagnostics.averageStrength)}</div>
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-100 bg-amber-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-amber-800">QA result</h3>
            <p className="mt-2 text-sm text-amber-900">
              Coverage score: {qa.coverageScore ?? '-'} | Hallucination risk: {qa.hallucinationRisk || '-'} | Passed: {qa.passed ? 'Yes' : 'No'}
            </p>
            <p className="mt-2 text-sm text-amber-900">
              QA question alignment: {qaDiagnostics.interviewerQuestionCount ?? '-'} / {qaDiagnostics.plannedQuestionCount ?? '-'} | Avg evidence strength: {formatNumber(qaDiagnostics.averageEvidenceStrength)}
            </p>
            {(qa.qualityFlags || []).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(qa.qualityFlags || []).map((flag) => (
                  <span key={flag} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-amber-800 shadow-sm">
                    {titleCase(flag)}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </details>
    </>
  );
}
