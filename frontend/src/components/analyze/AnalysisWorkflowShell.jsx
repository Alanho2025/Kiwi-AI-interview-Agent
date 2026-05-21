import { CheckCircle2, Circle, Lock, AlertTriangle } from 'lucide-react';
import { cn } from '../../utils/formatters.js';

const toneStyles = {
  complete: 'border-emerald-100 bg-emerald-50 text-emerald-800',
  active: '[border-color:var(--accent)] [background:var(--accent-glow)] text-primary',
  blocked: 'border-gray-100 bg-gray-50 text-gray-400',
  warning: 'border-amber-100 bg-amber-50 text-amber-800',
};

const StepIcon = ({ complete, active, blocked, warning }) => {
  if (complete) return <CheckCircle2 className="h-4 w-4" />;
  if (blocked) return <Lock className="h-4 w-4" />;
  if (warning) return <AlertTriangle className="h-4 w-4" />;
  return <Circle className={cn('h-4 w-4', active ? 'text-accent' : 'text-gray-300')} />;
};

export function AnalysisWorkflowShell({ steps = [], activeStepId, onStepChange }) {
  return (
    <div className="rounded-2xl border border-theme glass px-3 py-2 shadow-sm">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {steps.map((step) => {
          const active = step.id === activeStepId;
          const tone = step.blocked ? 'blocked' : step.warning ? 'warning' : step.complete ? 'complete' : active ? 'active' : 'blocked';
          return (
            <button
              key={step.id}
              type="button"
              disabled={step.blocked}
              onClick={() => onStepChange?.(step.id)}
              className={cn(
                'flex min-h-14 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors',
                toneStyles[tone],
                active && 'ring-2 ring-accent/15',
                !step.blocked && 'hover:border-theme'
              )}
            >
              <span className="shrink-0">
                <StepIcon complete={step.complete} active={active} blocked={step.blocked} warning={step.warning} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold">{step.label}</span>
                <span className="mt-0.5 block truncate text-xs opacity-80">{step.detail}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
