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

const clampScore = (value = 0) => {
  const score = Number(value || 0);
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.min(100, score));
};

const resolveInterviewScore = (report = {}) => {
  const interviewPerformance = report.scores?.interviewPerformance;
  if (Number.isFinite(Number(interviewPerformance))) return Number(interviewPerformance);

  const evidenceStrength = Number(report.scores?.evidenceStrength);
  if (Number.isFinite(evidenceStrength)) return evidenceStrength <= 4 ? (evidenceStrength / 4) * 100 : evidenceStrength;
  return 0;
};

const resolveScoreExplanation = ({ key, score, candidateFeedback = {}, report = {} }) => {
  const explicit = candidateFeedback.scoreExplanations?.[key];
  if (explicit?.summary || explicit?.helped || explicit?.lowered || explicit?.next) {
    return explicit;
  }

  const strengths = report.candidateFeedback?.strengthHighlights || candidateFeedback.strengthHighlights || [];
  const priorities = report.candidateFeedback?.improvementPriorities || candidateFeedback.improvementPriorities || [];
  const firstStrength = strengths[0]?.title || strengths[0]?.explanation || 'Clear role alignment in some areas';
  const firstPriority = priorities[0]?.title || priorities[0]?.action || 'Add clearer evidence and measurable outcomes';

  const templates = {
    overall: {
      summary: score >= 75 ? 'Strong base, with a few coaching levers left.' : 'Useful signal, but the evidence needs more depth.',
      helped: firstStrength,
      lowered: score >= 75 ? 'Some answers could still be more specific.' : firstPriority,
      next: 'Improve the weakest evidence gap first.',
    },
    cvJdMatch: {
      summary: score >= 75 ? 'Your CV matches several core role signals.' : 'The CV fit is directional, not fully convincing yet.',
      helped: firstStrength,
      lowered: 'Missing or unclear proof for some JD requirements.',
      next: 'Rewrite CV bullets around the target requirements.',
    },
    interview: {
      summary: score >= 75 ? 'Your answers were mostly clear and relevant.' : 'Your answers need stronger examples to land better.',
      helped: 'Logical answer flow and role-relevant intent.',
      lowered: firstPriority,
      next: 'Use STAR plus one measurable result per answer.',
    },
  };

  return templates[key] || templates.overall;
};

function ExplanationChip({ label, value }) {
  if (!value) return null;
  return (
    <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className="mt-1 text-xs leading-5 text-gray-700">{value}</p>
    </div>
  );
}

function ScoreExplanationCard({ title, score, subtitle, ringClass, accentClass, explanation }) {
  const safeScore = clampScore(score);
  return (
    <div className={`rounded-2xl bg-white p-4 shadow-sm ring-1 ${ringClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-xs font-semibold uppercase tracking-[0.16em] ${accentClass}`}>{title}</p>
          <p className="mt-2 text-3xl font-semibold text-gray-900">{formatNumber(safeScore)}</p>
          <p className="mt-1 text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className="h-12 w-12 rounded-full bg-gray-50 p-1 ring-1 ring-gray-100" aria-hidden="true">
          <div
            className="h-full w-full rounded-full bg-white text-center text-[10px] font-semibold leading-[40px] text-gray-600 ring-1 ring-gray-100"
            title={`${Math.round(safeScore)} out of 100`}
          >
            {Math.round(safeScore)}%
          </div>
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-gray-700">{explanation.summary}</p>
      <ExplanationChip label="Next lever" value={explanation.next} />
    </div>
  );
}

/**
 * Purpose: Execute the main responsibility for ReportHeroCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function ReportHeroCard({ report, qa, takeaway, scoreBand, generationSource }) {
  const candidateFeedback = report.candidateFeedback || {};
  const scores = {
    overall: report.scores?.overall,
    cvJdMatch: report.scores?.cvJdMatch ?? report.scores?.overall,
    interview: resolveInterviewScore(report),
  };

  const explanations = {
    overall: resolveScoreExplanation({ key: 'overall', score: scores.overall, candidateFeedback, report }),
    cvJdMatch: resolveScoreExplanation({ key: 'cvJdMatch', score: scores.cvJdMatch, candidateFeedback, report }),
    interview: resolveScoreExplanation({ key: 'interview', score: scores.interview, candidateFeedback, report }),
  };

  return (
    <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <CardContent className="p-5 sm:p-8">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex rounded-lg bg-white/80 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Interview Report
              </div>
              <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-gray-900">Your Interview Feedback</h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-gray-700">{takeaway}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-800">{scoreBand}</span>
                {generationSource === 'ai' ? <span className="rounded-lg bg-sky-100 px-3 py-1.5 text-sm font-medium text-sky-800">AI-generated coaching</span> : null}
                {generationSource === 'fallback' ? <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800">Fallback coaching</span> : null}
                <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm">Decision: {titleCase(report.summary?.match(/Decision:\s*([^.]*)\./i)?.[1] || 'manual_review')}</span>
                <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm">QA: {qa.passed ? 'Passed' : 'Needs review'}</span>
              </div>
            </div>
          </div>

          <div className="grid gap-3 rounded-2xl border border-white/80 bg-white/70 p-4 shadow-sm md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Strongest signal</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">{explanations.overall.helped}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">Next improvement</p>
              <p className="mt-2 text-sm leading-6 text-gray-700">{explanations.overall.next}</p>
            </div>
          </div>

          <div className="grid w-full gap-3 md:grid-cols-3">
            <ScoreExplanationCard
              title="Overall"
              score={scores.overall}
              subtitle="CV fit + interview evidence"
              ringClass="ring-emerald-100"
              accentClass="text-emerald-600"
              explanation={explanations.overall}
            />
            <ScoreExplanationCard
              title="CV-JD Match"
              score={scores.cvJdMatch}
              subtitle="Resume fit signal"
              ringClass="ring-gray-100"
              accentClass="text-gray-500"
              explanation={explanations.cvJdMatch}
            />
            <ScoreExplanationCard
              title="Interview"
              score={scores.interview}
              subtitle="Answer quality signal"
              ringClass="ring-sky-100"
              accentClass="text-sky-600"
              explanation={explanations.interview}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
