import { AlertCircle, CheckCircle2, Lightbulb, Target } from 'lucide-react';

const STATUS_LABELS = {
  covered: 'Clearly demonstrated',
  partial: 'Partly demonstrated',
  missing: 'Needs stronger evidence',
  unavailable: 'Not assessed',
};

const ANSWER_LABELS = {
  strong: 'Strong match for this answer',
  partial: 'Partly matched this focus',
  weak: 'Needs a clearer connection',
  off_target: 'Did not yet answer this focus',
  unavailable: 'Not assessed',
};

const ALIGNMENT_DIMENSION_LABELS = {
  questionAlignment: 'Question alignment',
  evidenceFit: 'Evidence fit',
  evidenceClarity: 'Evidence clarity',
  roleIntentFit: 'Role intent fit',
  naturalness: 'Naturalness',
  concision: 'Concision',
};

const buildDimensionRows = (scoreBreakdown = {}) => Object.entries(ALIGNMENT_DIMENSION_LABELS)
  .map(([key, label]) => ({ key, label, value: scoreBreakdown[key] }))
  .filter((item) => Number.isFinite(Number(item.value)));

export function RoleFitReportSection({ roleFit = {} }) {
  if (!roleFit.available) {
    return (
      <section className="border-y border-amber-200 bg-amber-50/70 px-1 py-5" aria-labelledby="role-fit-unavailable-title">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <h2 id="role-fit-unavailable-title" className="text-base font-semibold text-amber-950">Role-specific coaching is unavailable</h2>
            <p className="mt-1 text-sm leading-6 text-amber-900">Your existing interview feedback is still available. Review the job details before your next practice session.</p>
          </div>
        </div>
      </section>
    );
  }

  const coverage = roleFit.roleIntentCoverage || {};
  const isReady = roleFit.status === 'ready';
  return (
    <section className="border-y border-theme py-6" aria-labelledby="role-fit-report-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {isReady
            ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
            : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />}
          <div className="min-w-0">
            <h2 id="role-fit-report-title" className="text-lg font-semibold text-primary">How your answers matched this role</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              {coverage.covered || 0} of {coverage.total || 0} focus areas clearly demonstrated
            </p>
          </div>
        </div>
        <p className={`text-sm font-semibold ${isReady ? 'text-emerald-700' : 'text-amber-700'}`}>
          {isReady ? 'Role evidence ready' : 'Some evidence needs work'}
        </p>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-primary">
            <Target className="h-4 w-4 text-sky-600" />
            Role focus areas
          </h3>
          <div className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
            {(coverage.items || []).map((item) => (
              <div key={`${item.label}:${item.status}`} className="flex items-start justify-between gap-4 py-3">
                <p className="min-w-0 break-words text-sm font-medium text-primary">{item.label}</p>
                <p className="shrink-0 text-xs font-medium text-muted">{STATUS_LABELS[item.status] || 'Not assessed'}</p>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-primary">Examples you used</h3>
          {(roleFit.evidenceUsageMap?.items || []).length ? (
            <div className="mt-3 divide-y divide-gray-100 border-y border-gray-100">
              {roleFit.evidenceUsageMap.items.map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 py-3">
                  <p className="min-w-0 break-words text-sm font-medium text-primary">{item.label}</p>
                  <p className="shrink-0 text-xs text-muted">Used {item.useCount} time{item.useCount === 1 ? '' : 's'}</p>
                </div>
              ))}
            </div>
          ) : <p className="mt-3 text-sm leading-6 text-muted">No CV example could be linked confidently. Use a more specific project, action, and result next time.</p>}
        </div>
      </div>

      {(roleFit.answerAlignments || []).length ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-primary">Answer-by-answer role fit</h3>
          <div className="mt-3 grid gap-3">
            {roleFit.answerAlignments.map((alignment, index) => (
              <article key={alignment.turnId || index} className="rounded-lg border border-gray-200 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <p className="min-w-0 break-words text-sm font-semibold text-primary">{alignment.question}</p>
                  <p className="shrink-0 text-sm font-semibold text-sky-700">{ANSWER_LABELS[alignment.label] || 'Not assessed'} · {alignment.score}/100</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{alignment.diagnosis?.mainIssue}</p>
                {buildDimensionRows(alignment.scoreBreakdown).length ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {buildDimensionRows(alignment.scoreBreakdown).map((dimension) => (
                      <p key={dimension.key} className="text-xs font-medium text-muted">
                        {dimension.label}: {dimension.value}
                      </p>
                    ))}
                  </div>
                ) : null}
                {alignment.betterAnswerPlan?.direction ? (
                  <p className="mt-2 flex items-start gap-2 text-sm leading-6 text-primary">
                    <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-amber-600" />
                    {alignment.betterAnswerPlan.direction}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {(roleFit.questionReasoning || []).length ? (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-primary">Why these areas were practised</h3>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-muted">
            {roleFit.questionReasoning.map((item, index) => (
              <li key={`${item.topic}:${index}`}><span className="font-medium text-primary">Why we asked about {item.topic}:</span> {item.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
