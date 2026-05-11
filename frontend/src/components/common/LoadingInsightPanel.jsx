import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/formatters.js';

const stageTips = {
  jd: [
    'Extracting must-have requirements...',
    'Separating core responsibilities from nice-to-have skills...',
    'Checking whether the JD has enough evidence for matching...',
  ],
  match: [
    'Comparing CV evidence against role requirements...',
    'Checking must-have fit and skill coverage...',
    'Preparing the match summary...',
  ],
  report: [
    'Summarising your strongest answer signals...',
    'Building question-by-question coaching...',
    'Preparing score explanations and next practice focus...',
  ],
};

const skeletonWidths = ['w-5/6', 'w-3/4', 'w-4/6'];

export function LoadingInsightPanel({
  stage = 'match',
  title = 'KiwiCoach is working...',
  message = 'This may take a few seconds.',
  compact = false,
  skeletonLayout = 'generic',
}) {
  const tips = useMemo(() => stageTips[stage] || stageTips.match, [stage]);
  const [tipIndex, setTipIndex] = useState(0);

  useEffect(() => {
    setTipIndex(0);
    const timer = window.setInterval(() => {
      setTipIndex((current) => (current + 1) % tips.length);
    }, 2200);

    return () => window.clearInterval(timer);
  }, [tips]);

  return (
    <div className={cn('space-y-5', compact && 'space-y-4')}>
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full [background:var(--accent-glow)]">
          <Loader2 className="h-5 w-5 animate-spin text-accent" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-primary">{title}</p>
          <p className="mt-1 text-xs text-faint">{message}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-transparent p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-faint">Now checking</p>
        <p className="mt-2 min-h-5 text-sm font-medium text-primary">{tips[tipIndex]}</p>
        
        {skeletonLayout === 'match' ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-theme glass p-5 opacity-70">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-4 w-full">
                  <div className="flex h-11 w-11 shrink-0 animate-pulse rounded-full bg-chip" />
                  <div className="w-full space-y-3">
                    <div className="h-3 w-24 animate-pulse rounded-full bg-chip" />
                    <div className="h-6 w-1/3 animate-pulse rounded-full bg-gray-300" />
                    <div className="h-4 w-3/4 animate-pulse rounded-full bg-chip" />
                    <div className="h-4 w-2/3 animate-pulse rounded-full bg-chip" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 lg:min-w-56 shrink-0">
                  <div className="rounded-xl border border-gray-100 bg-transparent p-4">
                    <div className="h-3 w-16 animate-pulse rounded-full bg-chip" />
                    <div className="mt-3 h-8 w-12 animate-pulse rounded-full bg-gray-300" />
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-transparent p-4">
                    <div className="h-3 w-16 animate-pulse rounded-full bg-chip" />
                    <div className="mt-3 h-8 w-14 animate-pulse rounded-full bg-gray-300" />
                  </div>
                </div>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-3 opacity-70">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl border border-theme glass p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-full">
                      <div className="h-4 w-24 animate-pulse rounded-full bg-gray-300" />
                      <div className="mt-2 h-3 w-full animate-pulse rounded-full bg-chip" />
                    </div>
                    <div className="h-5 w-16 shrink-0 animate-pulse rounded-full bg-chip" />
                  </div>
                  <div className="mt-5 h-8 w-16 animate-pulse rounded-full bg-gray-300" />
                  <div className="mt-3 h-3 w-4/5 animate-pulse rounded-full bg-chip" />
                  <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-chip" />
                </div>
              ))}
            </div>
          </div>
        ) : skeletonLayout === 'report' ? (
          <div className="mt-5 space-y-6">
            <div className="flex flex-col md:flex-row gap-4 opacity-70">
              <div className="flex-1 rounded-2xl border border-theme glass p-5 lg:p-6">
                <div className="h-3 w-24 animate-pulse rounded-full bg-chip" />
                <div className="mt-2 h-8 w-1/3 animate-pulse rounded-full bg-gray-300" />
                <div className="mt-4 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded-full bg-chip" />
                  <div className="h-4 w-5/6 animate-pulse rounded-full bg-chip" />
                  <div className="h-4 w-4/5 animate-pulse rounded-full bg-chip" />
                </div>
              </div>
              <div className="flex flex-row md:flex-col gap-3 shrink-0 md:w-48">
                {[1, 2].map((i) => (
                  <div key={i} className="flex-1 rounded-2xl border border-theme glass p-4">
                    <div className="h-3 w-20 animate-pulse rounded-full bg-chip" />
                    <div className="mt-3 h-8 w-16 animate-pulse rounded-full bg-gray-300" />
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-theme glass p-5 lg:p-6 opacity-70">
              <div className="h-6 w-48 animate-pulse rounded-full bg-gray-300" />
              <div className="mt-6 space-y-4">
                {[1, 2].map((i) => (
                  <div key={i} className="rounded-xl bg-transparent p-4 border border-gray-100">
                    <div className="flex gap-3">
                      <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-chip" />
                      <div className="w-full space-y-2">
                        <div className="h-4 w-1/4 animate-pulse rounded-full bg-gray-300" />
                        <div className="h-3 w-full animate-pulse rounded-full bg-chip" />
                        <div className="h-3 w-5/6 animate-pulse rounded-full bg-chip" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {skeletonWidths.map((width, index) => (
              <div key={width} className="rounded-xl border border-gray-100 glass p-3 shadow-sm">
                <div className="h-3 w-20 animate-pulse rounded-full bg-chip" />
                <div className={cn('mt-4 h-7 animate-pulse rounded-full bg-chip', index === 0 ? 'w-16' : 'w-20')} />
                <div className={cn('mt-3 h-3 animate-pulse rounded-full bg-chip', width)} />
                <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-chip" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
