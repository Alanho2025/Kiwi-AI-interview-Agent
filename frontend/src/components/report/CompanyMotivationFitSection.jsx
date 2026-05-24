import { ArrowUpRight, ClipboardCheck, SearchCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

const formatScore = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1).replace(/\.0$/, '') : '-';
};

const getSourceLabel = (source, fallbackReason) => {
  if (source === 'official_website' || source === 'manual') return 'Official company context';
  if (fallbackReason) return 'General rubric fallback';
  return 'General motivation rubric';
};

const getAvailabilityText = (fit = {}) => {
  if (fit.source === 'official_website' || fit.source === 'manual') {
    return 'Company-specific sources were available and used for this section.';
  }
  return 'Company-specific sources were not available, so the system used the general motivation rubric.';
};

const getNextImprovementText = (fit = {}) =>
  fit.suggestedRewrite ||
  (fit.missingValues || []).map((item) => item.suggestion).filter(Boolean)[0] ||
  'Before the next interview, prepare one company fact, one role-specific responsibility, and one personal project link.';

const ThreePartBlock = ({ icon: Icon, title, children }) => (
  <div className="rounded-xl border border-theme glass p-4">
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-accent" aria-hidden="true" />
      <h4 className="text-sm font-semibold text-primary">{title}</h4>
    </div>
    <p className="mt-3 text-sm leading-6 text-muted">{children}</p>
  </div>
);

export function CompanyMotivationFitSection({ fit }) {
  if (!fit?.summary) return null;

  const sourceLabel = getSourceLabel(fit.source, fit.fallbackReason);
  return (
    <Card>
      <CardHeader className="items-start">
        <div>
          <CardTitle>Company & Role Motivation Fit</CardTitle>
          <p className="mt-1 text-sm text-faint">Feedback on the answer to what attracted you to the company and role.</p>
        </div>
        <span className="shrink-0 rounded-full bg-chip px-3 py-1 text-xs font-semibold text-muted">
          {sourceLabel}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)]">
          <div className="rounded-xl border border-theme glass p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Score</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold leading-none text-primary">{formatScore(fit.score)}</span>
              <span className="pb-1 text-sm font-medium text-muted">/ 10</span>
            </div>
          </div>
          <div className="grid gap-4">
            <ThreePartBlock icon={SearchCheck} title="Company research availability">
              {getAvailabilityText(fit)}
            </ThreePartBlock>
            <ThreePartBlock icon={ClipboardCheck} title="Candidate performance">
              {fit.summary}
            </ThreePartBlock>
            <ThreePartBlock icon={ArrowUpRight} title="Next improvement">
              {getNextImprovementText(fit)}
            </ThreePartBlock>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
