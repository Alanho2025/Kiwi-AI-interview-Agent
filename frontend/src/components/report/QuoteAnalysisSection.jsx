import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

export function QuoteAnalysisSection({ quoteAnalyses }) {
  if (!quoteAnalyses || quoteAnalyses.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Interview Highlights & Critiques</CardTitle>
        <p className="text-sm text-faint mt-1">Based on your actual responses during the interview.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {quoteAnalyses.map((analysis, index) => (
            <div key={`${analysis.id}-${index}`} className="overflow-hidden rounded-2xl border border-gray-100 glass shadow-sm transition-all hover:shadow-md">
              
              {/* Context Header */}
              {analysis.context && (
                <div className="bg-transparent px-5 py-3 border-b border-gray-100">
                  <span className="text-xs font-semibold uppercase tracking-wider text-faint">Context</span>
                  <p className="mt-1 text-sm font-medium text-muted">{analysis.context}</p>
                </div>
              )}

              <div className="p-5 space-y-4">
                {/* The Quote */}
                <div className="relative rounded-xl bg-blue-50/50 p-4 border border-blue-100/50">
                  <div className="absolute -left-2 -top-3 text-4xl text-blue-200 font-serif">"</div>
                  <p className="text-sm italic leading-relaxed text-blue-900 relative z-10">
                    {analysis.quote}
                  </p>
                </div>

                {/* Critique */}
                <div className="rounded-xl bg-amber-50 p-4 border border-amber-100/50">
                  <p className="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-2">Coach's Critique</p>
                  <p className="text-sm leading-6 text-amber-900">{analysis.critique}</p>
                </div>

                {/* Rewrite */}
                {analysis.rewrite && (
                  <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-100/50">
                    <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-2">How to say it better</p>
                    <p className="text-sm leading-6 text-emerald-900">{analysis.rewrite}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
