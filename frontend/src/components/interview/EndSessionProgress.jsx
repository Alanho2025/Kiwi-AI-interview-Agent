/**
 * File responsibility: End-session progress UI.
 * Main responsibilities:
 * - Show visible progress after the user confirms End Interview.
 * - Make saving, report generation, completion, and failure states clear.
 */

import { cn } from '../../utils/formatters.js';

const steps = [
  { key: 'saving', label: 'Saving session' },
  { key: 'generating_report', label: 'Generating report' },
  { key: 'completed', label: 'Completed' },
];

const resolveActiveIndex = (step) => {
  if (step === 'failed') return steps.findIndex((item) => item.key === 'generating_report');
  const index = steps.findIndex((item) => item.key === step);
  return index >= 0 ? index : 0;
};

export function EndSessionProgress({ progress }) {
  if (!progress?.active) return null;

  const activeIndex = resolveActiveIndex(progress.step);
  const isFailed = progress.step === 'failed';

  return (
    <div className={cn('rounded-2xl border glass p-4 shadow-sm', isFailed ? 'border-red-200' : 'border-sky-100')}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-primary">Ending interview</p>
          <p className="mt-1 text-xs text-faint">Please keep this page open while we save your session.</p>
        </div>
        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', isFailed ? 'bg-red-50 text-red-700' : 'bg-sky-50 text-sky-700')}>
          {isFailed ? 'Failed' : progress.step === 'completed' ? 'Done' : 'Working'}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => {
          const isDone = progress.step === 'completed' || index < activeIndex;
          const isActive = !isFailed && index === activeIndex && progress.step !== 'completed';

          return (
            <div key={step.key} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-transparent px-3 py-2 text-sm">
              <span className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold',
                isDone ? 'bg-emerald-100 text-emerald-700' : isActive ? 'bg-sky-100 text-sky-700' : 'glass text-gray-400'
              )}>
                {isDone ? '✓' : index + 1}
              </span>
              <span className={cn(isActive ? 'font-semibold text-primary' : 'text-faint')}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {progress.error ? (
        <p className="mt-3 text-sm text-red-600">{progress.error}</p>
      ) : null}
    </div>
  );
}
