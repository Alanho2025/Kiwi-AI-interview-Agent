/**
 * File responsibility: Reusable UI component.
 * Main responsibilities:
 * - Keep presentation, state orchestration, and display helpers separated so React components stay reusable.
 * - Main file role: AnalysisStatusCard should render the UI block and receive data through props so the component stays reusable.
 * - Prefer extending behaviour by adding small helpers or sibling modules instead of growing one large file.
 * Maintenance notes:
 * - Keep this file focused on one layer of responsibility.
 * - Prefer composition and small helpers over repeated inline logic.
 */

import { Card, CardHeader, CardTitle, CardContent } from '../common/Card.jsx';
import { Loader2, CheckCircle2, AlertTriangle, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { cn } from '../../utils/formatters.js';
import { buildMatchResultViewModel } from '../../utils/matchResultViewModel.js';

const toneStyles = {
  success: {
    badge: 'bg-emerald-100 text-emerald-800',
    panel: 'border-emerald-100 bg-emerald-50',
    icon: 'bg-emerald-100 text-emerald-700',
  },
  info: {
    badge: 'bg-sky-100 text-sky-800',
    panel: 'border-sky-100 bg-sky-50',
    icon: 'bg-sky-100 text-sky-700',
  },
  warning: {
    badge: 'bg-amber-100 text-amber-800',
    panel: 'border-amber-100 bg-amber-50',
    icon: 'bg-amber-100 text-amber-700',
  },
  danger: {
    badge: 'bg-red-100 text-red-800',
    panel: 'border-red-100 bg-red-50',
    icon: 'bg-red-100 text-red-700',
  },
};

const getTone = (tone = 'info') => toneStyles[tone] || toneStyles.info;

const LoadingState = ({ title, message, progressClass }) => (
  <div className="space-y-4">
    <div className="flex items-center gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e6f7f0]">
        <Loader2 className="h-5 w-5 animate-spin text-[#2eb886]" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="text-xs text-gray-500">{message}</p>
      </div>
    </div>
    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
      <div className={cn('h-full animate-pulse rounded-full bg-[#2eb886]', progressClass)} />
    </div>
  </div>
);

const ScoreExplanationCard = ({ item }) => (
  <div className="rounded-xl border border-gray-100 bg-white p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-gray-900">{item.title}</p>
        <p className="mt-1 text-xs text-gray-500">{item.description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">{item.label}</span>
    </div>
    <p className="mt-4 text-2xl font-semibold text-gray-900">{item.score}/100</p>
    <p className="mt-2 text-xs leading-5 text-gray-600">{item.explanation}</p>
  </div>
);

const EvidenceBlock = ({ title, items, emptyText, tone = 'info' }) => {
  const styles = getTone(tone);

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.id || item.label} className="rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-800">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-gray-600">{item.detail}</p>
              {item.evidence ? (
                <p className={cn('mt-2 rounded-md px-2.5 py-2 text-xs leading-5', styles.badge)}>
                  Evidence: {item.evidence}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-500">{emptyText}</p>
      )}
    </div>
  );
};

const RequirementStatusPill = ({ tone, children }) => {
  const styles = getTone(tone);
  return <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', styles.badge)}>{children}</span>;
};

const RequirementChecks = ({ items }) => {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-4">
        <p className="text-sm font-semibold text-gray-900">Priority requirement checks</p>
        <p className="mt-3 text-sm text-gray-500">No requirement checks were produced.</p>
      </div>
    );
  }

  const visibleItems = items.slice(0, 5);
  const hiddenItems = items.slice(5);

  const renderRequirement = (item) => (
    <div key={item.id || item.label} className="rounded-lg bg-gray-50 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">{item.label}</p>
          <p className="mt-1 text-xs text-gray-500">{item.meta}</p>
        </div>
        <RequirementStatusPill tone={item.tone}>{item.status}</RequirementStatusPill>
      </div>
      <p className="mt-2 text-xs leading-5 text-gray-600">{item.reason}</p>
      {item.evidence ? <p className="mt-2 text-xs leading-5 text-gray-500">Evidence: {item.evidence}</p> : null}
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">Priority requirement checks</p>
          <p className="mt-1 text-xs text-gray-500">Highest-risk missing or partial requirements are shown first.</p>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-gray-400" />
      </div>
      <div className="mt-3 space-y-2">{visibleItems.map(renderRequirement)}</div>
      {hiddenItems.length ? (
        <details className="mt-3 rounded-lg border border-gray-100 bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-gray-600">Show {hiddenItems.length} more checks</summary>
          <div className="space-y-2 border-t border-gray-100 p-3">{hiddenItems.map(renderRequirement)}</div>
        </details>
      ) : null}
    </div>
  );
};

const MatchSummary = ({ viewModel }) => {
  const styles = getTone(viewModel.decision.tone);
  const Icon = viewModel.decision.tone === 'success' ? TrendingUp : viewModel.decision.tone === 'danger' ? AlertTriangle : Target;

  return (
    <div className={cn('rounded-2xl border p-5', styles.panel)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-full', styles.icon)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">CV-JD Match</p>
            <h3 className="mt-1 text-xl font-semibold text-gray-900">{viewModel.decision.label}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-700">{viewModel.summary}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:min-w-56">
          <div className="rounded-xl bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Match score</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{viewModel.overallScore}</p>
          </div>
          <div className="rounded-xl bg-white/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Confidence</p>
            <p className="mt-2 text-3xl font-semibold text-gray-900">{viewModel.confidencePercent}%</p>
          </div>
        </div>
      </div>
      <p className="mt-4 rounded-lg bg-white/70 px-3 py-2 text-xs leading-5 text-gray-600">{viewModel.decision.summary}</p>
    </div>
  );
};

/**
 * Purpose: Execute the main responsibility for AnalysisStatusCard.
 * Inputs: Uses the function parameters defined below and expects callers to pass validated data for this layer.
 * Returns: Returns the direct result of this operation, or a promise that resolves to that result for async flows.
 * Notes: Keep this function focused, and move extra branching or formatting into dedicated helpers when it starts growing.
 */
export function AnalysisStatusCard({ status, matchRate, analysisResult }) {
  const matchViewModel = buildMatchResultViewModel(analysisResult, matchRate);

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Match Analysis</CardTitle>
          <p className="mt-1 text-sm text-gray-500">Review the CV-JD fit before KiwiCoach builds the interview session.</p>
        </div>
      </CardHeader>
      <CardContent>
        {status === 'idle' && <div className="py-6 text-center text-sm text-gray-500">Upload a CV, paste the JD, and review the JD summary before matching.</div>}

        {status === 'summarizing' && (
          <LoadingState
            title="KiwiCoach is structuring the JD..."
            message="Extracting role responsibilities, must-have requirements, and skill signals."
            progressClass="w-1/3"
          />
        )}

        {status === 'matching' && (
          <LoadingState
            title="KiwiCoach is comparing your CV with the JD..."
            message="Checking role fit, skill evidence, and must-have requirement coverage."
            progressClass="w-2/3"
          />
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Match analysis complete</p>
                <p className="text-xs text-gray-500">Use this as the quick read before starting the interview.</p>
              </div>
            </div>

            <MatchSummary viewModel={matchViewModel} />

            <div className="grid gap-3 lg:grid-cols-3">
              {matchViewModel.scoreCards.map((item) => <ScoreExplanationCard key={item.key} item={item} />)}
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <EvidenceBlock
                title="What matched well"
                items={matchViewModel.matchedEvidence}
                emptyText="No strong CV evidence was identified yet."
                tone="success"
              />
              <EvidenceBlock
                title="What to validate or improve"
                items={matchViewModel.improvementEvidence}
                emptyText="No major risk or gap was highlighted by the current rubric."
                tone="warning"
              />
            </div>

            <RequirementChecks items={matchViewModel.requirementChecks} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
