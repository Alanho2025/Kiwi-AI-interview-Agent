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
import { CheckCircle2, AlertTriangle, ShieldCheck, Target, TrendingUp } from 'lucide-react';
import { cn } from '../../utils/formatters.js';
import { buildMatchResultViewModel } from '../../utils/matchResultViewModel.js';
import { LoadingInsightPanel } from '../common/LoadingInsightPanel.jsx';

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

const ScoreExplanationCard = ({ item }) => (
  <div className="rounded-xl border border-gray-100 glass p-4">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-primary">{item.title}</p>
        <p className="mt-1 text-xs text-faint">{item.description}</p>
      </div>
      <span className="shrink-0 rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-muted">{item.label}</span>
    </div>
    <p className="mt-4 text-2xl font-semibold text-primary">{item.score}/100</p>
    <p className="mt-2 text-xs leading-5 text-muted">{item.explanation}</p>
  </div>
);

const EvidenceBlock = ({ title, items, emptyText, tone = 'info' }) => {
  const styles = getTone(tone);

  return (
    <div className="rounded-xl border border-gray-100 glass p-4">
      <p className="text-sm font-semibold text-primary">{title}</p>
      {items.length ? (
        <div className="mt-3 space-y-3">
          {items.map((item) => (
            <div key={item.id || item.label} className="rounded-lg bg-transparent p-3">
              <p className="text-sm font-semibold text-primary">{item.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{item.detail}</p>
              {item.evidence ? (
                <p className={cn('mt-2 rounded-md px-2.5 py-2 text-xs leading-5', styles.badge)}>
                  Evidence: {item.evidence}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-faint">{emptyText}</p>
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
      <div className="rounded-xl border border-gray-100 glass p-4">
        <p className="text-sm font-semibold text-primary">Priority requirement checks</p>
        <p className="mt-3 text-sm text-faint">No requirement checks were produced.</p>
      </div>
    );
  }

  const visibleItems = items.slice(0, 5);
  const hiddenItems = items.slice(5);

  const renderRequirement = (item) => (
    <div key={item.id || item.label} className="rounded-lg bg-transparent p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">{item.label}</p>
          {item.originalLabel && item.originalLabel !== item.label ? (
            <p className="mt-1 text-xs leading-5 text-faint">Original JD: {item.originalLabel}</p>
          ) : null}
          <p className="mt-1 text-xs text-faint">{item.meta}</p>
        </div>
        <RequirementStatusPill tone={item.tone}>{item.status}</RequirementStatusPill>
      </div>
      <p className="mt-2 text-xs leading-5 text-muted">{item.reason}</p>
      {item.evidenceStrength ? <p className="mt-2 text-xs font-semibold text-muted">Evidence strength: {item.evidenceStrength}</p> : null}
      {item.evidence ? <p className="mt-2 text-xs leading-5 text-faint">Evidence: {item.evidence}</p> : null}
      {item.missingEvidence ? <p className="mt-2 text-xs leading-5 text-faint">Missing evidence: {item.missingEvidence}</p> : null}
      {item.interviewProbe ? <p className="mt-2 text-xs leading-5 text-faint">Interview probe: {item.interviewProbe}</p> : null}
    </div>
  );

  return (
    <div className="rounded-xl border border-gray-100 glass p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Priority requirement checks</p>
          <p className="mt-1 text-xs text-faint">Highest-risk missing or partial requirements are shown first.</p>
        </div>
        <ShieldCheck className="h-5 w-5 shrink-0 text-gray-400" />
      </div>
      <div className="mt-3 space-y-2">{visibleItems.map(renderRequirement)}</div>
      {hiddenItems.length ? (
        <details className="mt-3 rounded-lg border border-gray-100 glass">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted">Show {hiddenItems.length} more checks</summary>
          <div className="space-y-2 border-t border-gray-100 p-3">{hiddenItems.map(renderRequirement)}</div>
        </details>
      ) : null}
    </div>
  );
};

const EvidenceStrengthSummary = ({ breakdown = {}, semanticEvidenceMatches = [], semanticEvidenceModel = null }) => {
  const hasBreakdown = Object.values(breakdown || {}).some((value) => Number(value) > 0);
  const visibleMatches = semanticEvidenceMatches
    .map((item) => ({
      label: item.label,
      match: (item.matches || [])[0],
    }))
    .filter((item) => item.label && item.match);

  if (!hasBreakdown && !visibleMatches.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-gray-100 glass p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-primary">Evidence strength diagnostics</p>
          <p className="mt-1 text-xs text-faint">Semantic matching explains which CV lines support the JD requirements.</p>
        </div>
        {semanticEvidenceModel?.scorer ? (
          <span className="rounded-lg bg-chip px-2.5 py-1 text-xs font-semibold text-muted">{semanticEvidenceModel.scorer}</span>
        ) : null}
      </div>

      {hasBreakdown ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-800">Strong {breakdown.strong || 0}</span>
          <span className="rounded-lg bg-sky-100 px-3 py-1.5 text-xs font-semibold text-sky-800">Partial {breakdown.partial || 0}</span>
          <span className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-800">Weak {breakdown.weak || 0}</span>
          <span className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-800">Missing {breakdown.missing || 0}</span>
        </div>
      ) : null}

      {visibleMatches.length ? (
        <div className="mt-4 space-y-2">
          {visibleMatches.slice(0, 3).map((item) => {
            const similarity = Math.round(Number(item.match.score || 0) * 100);
            const strength = item.match.evidenceStrength || 'weak';
            return (
              <div key={item.label} className="rounded-lg bg-transparent p-3">
                <p className="text-sm font-semibold text-primary">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-muted">Semantic similarity: {similarity}%</p>
                <p className="mt-1 text-xs leading-5 text-muted">Evidence strength: {strength}</p>
                {strength === 'weak' && similarity >= 75 ? (
                  <p className="mt-1 text-xs leading-5 text-faint">
                    The wording is related, but the CV evidence still needs direct applied proof.
                  </p>
                ) : null}
                <p className="mt-2 text-xs leading-5 text-faint">{item.match.text}</p>
              </div>
            );
          })}
        </div>
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
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">CV-JD Match</p>
            <h3 className="mt-1 text-xl font-semibold text-primary">{viewModel.decision.label}</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{viewModel.summary}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:min-w-56">
          <div className="rounded-xl glass/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Match score</p>
            <p className="mt-2 text-3xl font-semibold text-primary">{viewModel.overallScore}</p>
          </div>
          <div className="rounded-xl glass/80 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">Evidence confidence</p>
            <p className="mt-2 text-3xl font-semibold text-primary">{viewModel.confidencePercent}%</p>
          </div>
        </div>
      </div>
      <p className="mt-4 rounded-lg glass/70 px-3 py-2 text-xs leading-5 text-muted">{viewModel.decision.summary}</p>
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
          <p className="mt-1 text-sm text-faint">Review the CV-JD fit before KiwiCoach builds the interview session.</p>
        </div>
      </CardHeader>
      <CardContent>
        {status === 'idle' && <div className="py-6 text-center text-sm text-faint">Upload a CV, paste the JD, and review the JD summary before matching.</div>}

        {status === 'summarizing' && (
          <LoadingInsightPanel
            stage="jd"
            skeletonLayout="match"
            title="KiwiCoach is structuring the JD..."
            message="Extracting role responsibilities, must-have requirements, and skill signals."
          />
        )}

        {status === 'matching' && (
          <LoadingInsightPanel
            stage="match"
            skeletonLayout="match"
            title="KiwiCoach is comparing your CV with the JD..."
            message="Checking role fit, skill evidence, and must-have requirement coverage."
          />
        )}

        {status === 'error' && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-red-900">Match analysis could not finish</p>
                <p className="mt-1 text-sm leading-6 text-red-700">Check the page message, then rerun the analysis after fixing the input or service issue.</p>
              </div>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full [background:var(--accent-glow)]">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-primary">Match analysis complete</p>
                <p className="text-xs text-faint">Use this as the quick read before starting the interview.</p>
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

            <EvidenceStrengthSummary
              breakdown={matchViewModel.evidenceStrengthBreakdown}
              semanticEvidenceMatches={matchViewModel.semanticEvidenceMatches}
              semanticEvidenceModel={matchViewModel.semanticEvidenceModel}
            />

            <RequirementChecks items={matchViewModel.requirementChecks} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
