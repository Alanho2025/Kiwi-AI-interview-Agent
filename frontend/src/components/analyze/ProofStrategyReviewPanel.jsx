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
    <section className="border-y border-theme py-4" aria-labelledby="interview-focus-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <StatusIcon className={`mt-0.5 h-5 w-5 shrink-0 ${isReady ? 'text-emerald-600' : 'text-amber-600'}`} />
          <div className="min-w-0">
            <h3 id="interview-focus-title" className="text-sm font-semibold text-primary">
              {isReady ? 'Your interview focus is ready' : 'Interview focus needs a quick review'}
            </h3>
            <p className="mt-1 text-sm leading-6 text-muted">
              {isReady
                ? 'Review the main areas KiwiCoach will explore before you begin.'
                : getFallbackMessage(questionPoolInfo.degradedReason)}
            </p>
          </div>
        </div>
        <span className={`w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${isReady ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {isReady ? 'Ready to practise' : 'Review recommended'}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 divide-y divide-gray-100 border-y border-gray-100 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        <p className="py-3 text-sm font-medium text-primary sm:px-3 sm:first:pl-0">{focusAreaCount} focus areas</p>
        <p className="py-3 text-sm font-medium text-primary sm:px-3">{gapCount} gaps to explore</p>
        <p className="py-3 text-sm font-medium text-primary sm:px-3">{questionCount} practice questions</p>
      </div>

      {strategy.focusAreas?.length ? (
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {strategy.focusAreas.map((area) => (
            <div key={`${area.kind}:${area.label}`} className="flex min-w-0 items-start gap-2 py-1.5">
              <Target className={`mt-0.5 h-4 w-4 shrink-0 ${area.kind === 'gap' ? 'text-amber-600' : 'text-sky-600'}`} />
              <div className="min-w-0">
                <p className="break-words text-sm font-medium text-primary">{area.label}</p>
                <p className="mt-0.5 text-xs text-faint">{area.kind === 'gap' ? 'Needs a clear example' : 'Experience to explore'}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
