import { AlertTriangle, CheckCircle2, Target } from 'lucide-react';

const DEGRADED_MESSAGES = {
  missing_role_fit_artifacts: 'Check the job and company details, then generate the interview plan again.',
  unrepresented_must_cover_contracts: 'Some important areas could not be turned into questions. Review the job details before you begin.',
  insufficient_unique_prepared_questions: 'KiwiCoach prepared a shorter interview. You can continue, but some areas may receive less practice.',
  question_pool_preparation_failed: 'The interview will use general questions until the tailored focus can be prepared.',
};

const getFallbackMessage = (reason) => DEGRADED_MESSAGES[reason]
  || 'Review the job details before starting so the interview can stay focused on this role.';

export function ProofStrategyReviewPanel({ questionPoolInfo }) {
  if (!questionPoolInfo) return null;
  const strategy = questionPoolInfo.proofStrategy || {};
  const isReady = strategy.status === 'ready' && Number(strategy.unresolvedCount || 0) === 0;
  const focusAreaCount = Number(strategy.focusAreaCount || 0);
  const gapCount = Number(strategy.gapCount || 0);
  const questionCount = Number(questionPoolInfo.count || 0);
  const StatusIcon = isReady ? CheckCircle2 : AlertTriangle;

  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white/70 p-5"
      aria-labelledby="interview-focus-title"
      data-qa="qa:card:interview-preparation-priorities"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${isReady ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div className="min-w-0">
            <h3 id="interview-focus-title" className="text-sm font-semibold text-primary">
              {isReady ? 'Your interview preparation priorities' : 'Interview preparation needs a quick review'}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              {isReady
                ? 'Use these CV-JD priorities to prepare examples before you begin.'
                : getFallbackMessage(questionPoolInfo.degradedReason)}
            </p>
          </div>
        </div>
        <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {isReady ? 'Ready' : 'Review recommended'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-gray-50/70 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <p className="px-3 py-3 text-sm font-medium text-primary">{focusAreaCount} focus areas</p>
        <p className="px-3 py-3 text-sm font-medium text-primary">{gapCount} gaps to explore</p>
        <p className="px-3 py-3 text-sm font-medium text-primary">{questionCount} practice questions</p>
      </div>

      {strategy.focusAreas?.length ? (
        <div className="mt-4 divide-y divide-gray-100">
          {strategy.focusAreas.map((area) => (
            <div key={`${area.kind}:${area.label}`} className="flex min-w-0 items-start gap-3 py-3">
              <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${area.kind === 'gap' ? 'bg-amber-100 text-amber-700' : 'bg-sky-100 text-sky-700'}`}>
                <Target className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-sm font-semibold text-primary">{area.label}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${area.kind === 'gap' ? 'bg-amber-100 text-amber-800' : 'bg-sky-100 text-sky-800'}`}>
                    {area.kind === 'gap' ? 'Needs an example' : 'Experience'}
                  </span>
                </div>
                {area.preparationHint ? (
                  <p className="mt-1 break-words text-xs leading-5 text-muted">{area.preparationHint}</p>
                ) : null}
                {area.risk ? (
                  <p className="mt-1 break-words text-xs leading-5 text-amber-700">{area.risk}</p>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
