/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: ReportHeroCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import React from 'react';
import { Card, CardContent } from '../common/Card.jsx';
import { formatNumber, titleCase } from '../../utils/reportViewBuilder.js';

/**
 * Purpose: Execute the main responsibility for ReportHeroCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function ReportHeroCard({ report, qa, candidateFeedback, takeaway, scoreBand, generationSource }) {
  return (
    <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <CardContent className="p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Interview Report
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-gray-900">Your Interview Feedback</h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">{takeaway}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">{scoreBand}</span>
              {generationSource === 'ai' ? <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-800">AI-generated coaching</span> : null}
              {generationSource === 'fallback' ? <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">Fallback coaching</span> : null}
              <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">Decision: {titleCase(report.summary?.match(/Decision:\s*([^.]*)\./i)?.[1] || 'manual_review')}</span>
              <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">QA: {qa.passed ? 'Passed' : 'Needs review'}</span>
            </div>
          </div>

          <div className="grid w-full gap-3 sm:grid-cols-2 lg:max-w-sm">
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Overall score</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{formatNumber(report.scores?.overall)}</p>
              <p className="mt-1 text-sm text-gray-600">A snapshot of your current role fit.</p>
            </div>
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Evidence strength</p>
              <p className="mt-2 text-3xl font-semibold text-gray-900">{formatNumber(report.scores?.evidenceStrength)}</p>
              <p className="mt-1 text-sm text-gray-600">How concrete and convincing your answers sounded.</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
