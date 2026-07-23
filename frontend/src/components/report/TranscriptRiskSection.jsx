import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

const reviewItemsForRisk = (risk = {}) => (risk.evidence || []).flatMap((item = {}) => {
  const explicitItems = item.reviewItems || [];
  if (explicitItems.length) return explicitItems;
  if (!item.rawSnippet && !item.normalizedSnippet) return [];
  return [{
    rawSnippet: item.rawSnippet,
    proposedSnippet: item.normalizedSnippet,
    reasonLabel: 'transcript evidence unclear',
    riskLabel: risk.needsUserConfirmation ? 'High transcript risk' : 'Medium transcript risk',
  }];
});

const snippetText = (value, fallback) => value || fallback;

export function TranscriptRiskSection({ risks = [] }) {
  if (!risks.length) return null;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Transcript Checks Needed</CardTitle>
          <p className="mt-1 text-sm text-faint">
            Review these before relying on affected answers as final evidence.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {risks.map((risk, index) => {
            const reviewItems = reviewItemsForRisk(risk);
            return (
              <article key={`${risk.code}-${index}`} className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-amber-950">{risk.message}</p>
                    <p className="mt-2 text-xs text-amber-800">
                      Affected: {(risk.affectedTurnIds || []).join(', ') || 'interview transcript'}.
                    </p>
                  </div>
                  {risk.needsUserConfirmation ? (
                    <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-800">
                      Confirmation needed
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      Review later
                    </span>
                  )}
                </div>

                {reviewItems.length ? (
                  <div className="mt-4 space-y-3">
                    {reviewItems.map((item, itemIndex) => (
                      <div key={`${item.reasonLabel || 'review'}-${itemIndex}`} className="rounded-lg border border-amber-200 bg-white/70 p-3">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            {item.riskLabel || 'Transcript risk'}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
                            {item.reasonLabel || 'transcript evidence unclear'}
                          </span>
                        </div>
                        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-amber-900">Heard by system</dt>
                            <dd className="mt-1 text-amber-950">{snippetText(item.rawSnippet, 'Not available')}</dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-amber-900">Suggested check</dt>
                            <dd className="mt-1 text-amber-950">{snippetText(item.proposedSnippet, 'No proposed correction')}</dd>
                          </div>
                        </dl>
                      </div>
                    ))}
                  </div>
                ) : null}

                <p className="mt-3 text-xs text-amber-900">
                  Only correct words the system misheard. Do not add new answer content here.
                </p>
              </article>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
