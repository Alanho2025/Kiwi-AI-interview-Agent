import React from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleDashed, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';
import { cn } from '../../utils/formatters.js';

const formatScore = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(1).replace(/\.0$/, '') : '-';
};

const getScoreBand = (score) => {
  const numeric = Number(score);
  if (!Number.isFinite(numeric) || numeric <= 0) return { label: 'Evidence needed', className: 'bg-chip text-muted' };
  if (numeric >= 8) return { label: 'Strong', className: 'bg-chip text-accent' };
  if (numeric >= 6) return { label: 'Developing', className: 'bg-chip text-primary' };
  return { label: 'Needs clearer evidence', className: 'bg-chip text-amber-500' };
};

const getDimensionIcon = (dimension) => {
  if (dimension.riskDetected) return <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />;
  if (dimension.observed) return <CheckCircle2 className="h-4 w-4 text-accent" aria-hidden="true" />;
  return <CircleDashed className="h-4 w-4 text-faint" aria-hidden="true" />;
};

const EvidenceList = ({ title, items, tone }) => {
  if (!items.length) return null;
  return (
    <div>
      <h4 className={cn(
        'text-xs font-semibold uppercase tracking-[0.14em]',
        tone === 'risk' ? 'text-amber-500' : 'text-accent',
      )}
      >
        {title}
      </h4>
      <div className="mt-3 space-y-3">
        {items.slice(0, 3).map((item, index) => (
          <figure key={`${item.dimension}-${index}`} className="rounded-xl border border-theme glass p-3">
            <blockquote className="text-sm leading-6 text-primary">"{item.quote}"</blockquote>
            <figcaption className="mt-2 text-xs font-medium text-faint">{item.dimension}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
};

const CulturalContextPanel = ({ dimension }) => {
  if (!dimension.culturalContext && !dimension.exampleAnswer) return null;
  return (
    <div className="mt-3 rounded-xl border border-theme glass-darker p-3 space-y-3">
      {dimension.culturalContext && (
        <div>
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            <Lightbulb className="h-3.5 w-3.5" /> Why this matters in NZ
          </p>
          <p className="mt-1.5 text-sm leading-6 text-muted">{dimension.culturalContext}</p>
        </div>
      )}
      {dimension.interviewSignals?.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">What interviewers look for</p>
          <ul className="mt-1.5 space-y-1">
            {dimension.interviewSignals.slice(0, 3).map((signal, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
                {signal}
              </li>
            ))}
          </ul>
        </div>
      )}
      {dimension.exampleAnswer && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Model answer</p>
          <blockquote className="mt-1.5 rounded-lg bg-chip p-3 text-sm leading-6 text-primary italic">
            "{dimension.exampleAnswer}"
          </blockquote>
        </div>
      )}
    </div>
  );
};

export function NZWorkplaceFitSection({ fit }) {
  if (!fit?.enabled) return null;

  const scoreBand = getScoreBand(fit.score);
  const strengthEvidence = (fit.evidence || []).filter((item) => item.signal !== 'risk' && item.quote);
  const riskEvidence = (fit.evidence || []).filter((item) => item.signal === 'risk' && item.quote);
  const visibleDimensions = (fit.dimensionScores || []).slice(0, 8);
  const hasDetails = visibleDimensions.length > 0 || strengthEvidence.length > 0 || riskEvidence.length > 0;

  return (
    <Card>
      <CardHeader className="items-start">
        <div>
          <CardTitle>NZ Workplace Communication Fit</CardTitle>
          <p className="mt-1 text-sm text-faint">Interview communication signals for New Zealand workplace expectations.</p>
        </div>
        <span className={cn('shrink-0 rounded-full px-3 py-1 text-xs font-semibold', scoreBand.className)}>
          {scoreBand.label}
        </span>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="rounded-xl border border-theme glass p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">NZ workplace fit</p>
            <div className="mt-3 flex items-end gap-2">
              <span className="text-4xl font-semibold leading-none text-primary">{formatScore(fit.score)}</span>
              <span className="pb-1 text-sm font-medium text-muted">/ 10</span>
            </div>
            <p className="mt-4 text-sm leading-6 text-muted">{fit.summary}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-theme glass p-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Strengths</h4>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                {(fit.strengths || []).slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                {!(fit.strengths || []).length ? <li>More transcript evidence is needed before strengths can be identified.</li> : null}
              </ul>
            </div>
            <div className="rounded-xl border border-theme glass-darker p-4">
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-amber-500">Gaps</h4>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-muted">
                {(fit.gaps || []).slice(0, 3).map((item) => <li key={item}>{item}</li>)}
                {!(fit.gaps || []).length ? <li>No major NZ workplace communication gaps were detected in the available transcript.</li> : null}
              </ul>
            </div>
          </div>
        </div>

        {fit.suggestedRewrite?.weak && fit.suggestedRewrite?.better ? (
          <div className="mt-5 rounded-xl border border-theme glass p-4">
            <h4 className="text-sm font-semibold text-primary">Suggested rewrite</h4>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">Instead of</p>
                <p className="mt-2 text-sm leading-6 text-muted">"{fit.suggestedRewrite.weak}"</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">Try</p>
                <p className="mt-2 text-sm leading-6 text-primary">"{fit.suggestedRewrite.better}"</p>
              </div>
            </div>
            {fit.suggestedRewrite.reason ? (
              <p className="mt-3 text-sm leading-6 text-muted">
                <span className="font-semibold text-primary">Why this works:</span> {fit.suggestedRewrite.reason}
              </p>
            ) : null}
          </div>
        ) : null}

        {hasDetails ? (
          <details className="group mt-5 rounded-xl border border-theme">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-primary">Communication signal details</span>
              <ChevronDown className="h-4 w-4 text-faint transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-theme p-4">
              <div className="grid gap-3 md:grid-cols-2">
                {visibleDimensions.map((dimension) => (
                  <div key={dimension.id} className="rounded-xl border border-theme glass p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {getDimensionIcon(dimension)}
                          <h4 className="text-sm font-semibold text-primary">{dimension.label}</h4>
                        </div>
                        <p className="mt-2 text-sm leading-6 text-muted">{dimension.feedback}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-chip px-2.5 py-1 text-xs font-semibold text-muted">
                        {formatScore(dimension.score)}
                      </span>
                    </div>
                    <CulturalContextPanel dimension={dimension} />
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <EvidenceList title="Strength signals" items={strengthEvidence} tone="strength" />
                <EvidenceList title="Risk signals" items={riskEvidence} tone="risk" />
              </div>
            </div>
          </details>
        ) : null}
      </CardContent>
    </Card>
  );
}
