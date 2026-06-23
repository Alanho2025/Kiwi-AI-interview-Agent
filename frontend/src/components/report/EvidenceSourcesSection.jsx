import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

export function EvidenceSourcesSection({ items = [] }) {
  if (!items.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evidence Sources</CardTitle>
        <p className="mt-1 text-sm text-faint">Claim-level excerpts used to support the coaching feedback.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, index) => (
            <article key={`${item.claimId || item.claim}-${index}`} className="rounded-2xl border border-slate-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-primary">{item.claim}</h4>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">
                  {item.confidenceLevel || 'unknown'} confidence
                </span>
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-faint">{item.sourceLabel}</p>
              <blockquote className="mt-2 border-l-2 border-emerald-300 pl-3 text-sm leading-6 text-muted">
                {item.evidenceSnippet}
              </blockquote>
            </article>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

