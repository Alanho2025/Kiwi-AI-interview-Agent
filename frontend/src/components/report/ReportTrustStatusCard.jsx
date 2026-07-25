import {
  AlertTriangle,
  CircleHelp,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import { Button } from '../common/Button.jsx';

const TONE_STYLES = {
  success: {
    container: 'border-emerald-200 bg-emerald-50/90',
    icon: 'text-emerald-700',
    label: 'Checked',
    Icon: ShieldCheck,
  },
  warning: {
    container: 'border-amber-200 bg-amber-50/90',
    icon: 'text-amber-700',
    label: 'Review needed',
    Icon: AlertTriangle,
  },
  danger: {
    container: 'border-red-200 bg-red-50/90',
    icon: 'text-red-700',
    label: 'Verification incomplete',
    Icon: AlertTriangle,
  },
  info: {
    container: 'border-sky-200 bg-sky-50/90',
    icon: 'text-sky-700',
    label: 'Status unavailable',
    Icon: CircleHelp,
  },
};

export function ReportTrustStatusCard({
  summary,
  loading = false,
  onRecheck,
  onRegenerate,
}) {
  if (!summary) return null;

  const tone = TONE_STYLES[summary.tone] || TONE_STYLES.info;
  const Icon = tone.Icon;
  const canRecheck = summary.nextAction?.type === 'recheck_report' && Boolean(onRecheck);
  const canRegenerate = Boolean(onRegenerate)
    && ['needs_review', 'verification_incomplete'].includes(summary.status);

  return (
    <section
      className={`rounded-2xl border p-4 shadow-sm sm:p-5 ${tone.container}`}
      role="status"
      aria-live="polite"
      aria-label="Report verification status"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <div className={`mt-0.5 rounded-xl bg-white/70 p-2 ${tone.icon}`} aria-hidden="true">
            <Icon size={20} />
          </div>
          <div>
            <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${tone.icon}`}>
              {tone.label}
            </p>
            <h2 className="mt-1 text-base font-semibold text-primary">{summary.title}</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">{summary.message}</p>
          </div>
        </div>

        {canRecheck || canRegenerate ? (
          <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
            {canRecheck ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={loading}
                onClick={onRecheck}
              >
                <RefreshCw size={15} />
                {summary.nextAction.label}
              </Button>
            ) : null}
            {canRegenerate ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={loading}
                onClick={onRegenerate}
              >
                Generate fresh report
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
