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
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e6f7f0]">
          <Loader2 className="h-5 w-5 animate-spin text-[#2eb886]" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900">{title}</p>
          <p className="mt-1 text-xs text-gray-500">{message}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-500">Now checking</p>
        <p className="mt-2 min-h-5 text-sm font-medium text-gray-800">{tips[tipIndex]}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {skeletonWidths.map((width, index) => (
            <div key={width} className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <div className="h-3 w-20 animate-pulse rounded-full bg-gray-200" />
              <div className={cn('mt-4 h-7 animate-pulse rounded-full bg-gray-200', index === 0 ? 'w-16' : 'w-20')} />
              <div className={cn('mt-3 h-3 animate-pulse rounded-full bg-gray-100', width)} />
              <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
