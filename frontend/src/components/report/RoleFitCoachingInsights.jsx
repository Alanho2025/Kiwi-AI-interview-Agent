import { Lightbulb, ShieldCheck } from 'lucide-react';

const HYPOTHESIS_LABELS = {
  missing_validation: 'Make the check or validation step explicit.',
  abstract_example: 'Anchor the example in one concrete situation.',
  missing_result: 'Close with the measurable or observable result.',
  scope_not_stated: 'State the working scope before you answer.',
  answer_interrupted: 'Practise a short, complete answer for interrupted moments.',
};

const CoachingCard = ({ title, feedback, tip }) => {
  if (!feedback && !tip) return null;
  return (
    <div className="rounded-md border border-sky-100 bg-sky-50/60 p-3">
      <p className="text-xs font-semibold text-sky-900">{title}</p>
      {feedback ? <p className="mt-1 text-sm leading-6 text-slate-700">{feedback}</p> : null}
      {tip ? <p className="mt-2 text-sm font-medium leading-6 text-slate-900">Next time: {tip}</p> : null}
    </div>
  );
};

export function RoleFitCoachingInsights({ clarificationCoaching = {}, aiJudgementCoaching = {}, coachingProgress = {} }) {
  const hypotheses = coachingProgress.coachingHypotheses || [];
  const showProgress = coachingProgress.clarification?.practised || coachingProgress.aiJudgement?.assessed || hypotheses.length;
  return (
    <div className="mt-3 space-y-3">
      <CoachingCard
        title="Clarification coaching"
        feedback={clarificationCoaching.feedback}
        tip={clarificationCoaching.tip}
      />
      <CoachingCard
        title="AI judgement coaching"
        feedback={aiJudgementCoaching.feedback}
        tip={aiJudgementCoaching.tip}
      />
      {showProgress ? (
        <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-emerald-900"><ShieldCheck className="h-4 w-4" />Practice progress</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            Scope framing: {coachingProgress.clarification?.scopeConfirmed || 0} confirmed, {coachingProgress.clarification?.explicitAssumptions || 0} explicit assumption{coachingProgress.clarification?.explicitAssumptions === 1 ? '' : 's'}.
          </p>
          {coachingProgress.aiJudgement?.assessed ? (
            <p className="text-sm leading-6 text-slate-700">AI workflow: {coachingProgress.aiJudgement.verifiedWorkflows || 0} answer{coachingProgress.aiJudgement.verifiedWorkflows === 1 ? '' : 's'} explained verification.</p>
          ) : null}
          {hypotheses.length ? (
            <div className="mt-2 flex items-start gap-2 text-sm leading-6 text-slate-700"><Lightbulb className="mt-1 h-4 w-4 shrink-0 text-amber-600" />{HYPOTHESIS_LABELS[hypotheses[0]]}</div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
