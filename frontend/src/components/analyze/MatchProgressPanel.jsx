/**
 * File responsibility: Render backend-confirmed Match progress without inferred percentages.
 */

import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  LoaderCircle,
  MinusCircle,
} from 'lucide-react';

const statusStyles = {
  completed: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-600',
    textClass: 'text-primary',
  },
  started: {
    icon: LoaderCircle,
    iconClass: 'animate-spin text-sky-600',
    textClass: 'text-primary',
  },
  failed: {
    icon: AlertTriangle,
    iconClass: 'text-red-600',
    textClass: 'text-red-800',
  },
  skipped: {
    icon: MinusCircle,
    iconClass: 'text-gray-400',
    textClass: 'text-muted',
  },
};

const getVisibleStages = (progressStages = {}) => Object.values(progressStages)
  .filter((stage) => stage?.id && stage?.label)
  .sort((left, right) => Number(left.sequence || 0) - Number(right.sequence || 0));

export function MatchProgressPanel({ progressStages = {}, currentStage = null }) {
  const stages = getVisibleStages(progressStages);

  return (
    <section
      className="rounded-2xl border border-sky-100 bg-sky-50/70 p-5"
      aria-live="polite"
      aria-label="Match progress"
      data-qa="qa:panel:match-progress"
    >
      <div>
        <p className="text-sm font-semibold text-primary">Matching your CV to this role</p>
        <p className="mt-1 text-sm leading-6 text-muted">
          KiwiCoach is checking your evidence and quality-reviewing one canonical Match.
        </p>
      </div>

      {stages.length ? (
        <div className="mt-4 space-y-2">
          {stages.map((stage) => {
            const visual = statusStyles[stage.status] || {
              icon: Circle,
              iconClass: 'text-gray-300',
              textClass: 'text-muted',
            };
            const Icon = visual.icon;
            const isCurrent = stage.id === currentStage && stage.status === 'started';

            return (
              <div
                key={stage.id}
                className="flex items-center gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-3"
                data-qa={`qa:match-stage:${stage.id}`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${visual.iconClass}`} />
                <p className={`text-sm font-medium ${visual.textClass}`}>{stage.label}</p>
                {isCurrent ? (
                  <span className="ml-auto text-xs font-semibold text-sky-700">In progress</span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/80 bg-white/70 px-3 py-3">
          <LoaderCircle className="h-4 w-4 animate-spin text-sky-600" />
          <p className="text-sm font-medium text-primary">Starting Match analysis</p>
        </div>
      )}
    </section>
  );
}
