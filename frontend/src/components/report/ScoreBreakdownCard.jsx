import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

const formatKey = (value = '') => String(value)
  .replace(/_/g, ' ')
  .replace(/([a-z])([A-Z])/g, '$1 $2')
  .replace(/\b\w/g, (character) => character.toUpperCase());

export function ScoreBreakdownCard({ scoreExplanations, scoreLimitations }) {
  if (!scoreExplanations) return null;

  return (
    <Card className="border-indigo-100">
      <CardHeader className="bg-indigo-50/50">
        <CardTitle>Scoring Transparency</CardTitle>
        <p className="text-sm text-faint mt-1">Understand exactly how your scores were calculated.</p>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        
        {/* Overall Score */}
        {scoreExplanations.overall && (
          <div className="rounded-xl border border-slate-100 p-4">
            <h4 className="font-semibold text-slate-800">Overall Score</h4>
            <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
              Formula: {scoreExplanations.overall.formula}
            </div>
            <p className="mt-3 text-sm text-slate-700 leading-relaxed">
              {scoreExplanations.overall.explanation}
            </p>
          </div>
        )}

        {/* CV-JD Match */}
        {scoreExplanations.cvJdMatch && (
          <div className="rounded-xl border border-slate-100 p-4">
            <h4 className="font-semibold text-slate-800">CV-JD Requirement Match</h4>
            <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
              Formula: {scoreExplanations.cvJdMatch.formula}
            </div>
            <p className="mt-3 text-sm text-slate-700 leading-relaxed">
              {scoreExplanations.cvJdMatch.explanation}
            </p>
          </div>
        )}

        {/* Interview Performance */}
        {scoreExplanations.interviewPerformance && (
          <div className="rounded-xl border border-slate-100 p-4">
            <h4 className="font-semibold text-slate-800">Interview Performance</h4>
            <div className="mt-2 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100 font-mono">
              Formula: {scoreExplanations.interviewPerformance.formula}
            </div>
            <p className="mt-3 text-sm text-slate-700 leading-relaxed">
              {scoreExplanations.interviewPerformance.explanation}
            </p>
          </div>
        )}

        {/* STARR Structure */}
        {scoreExplanations.starStructure && (
          <div className="rounded-xl border border-slate-100 p-4">
            <h4 className="font-semibold text-slate-800">STARR Scoring Rules</h4>
            <p className="mt-3 text-sm text-slate-700 leading-relaxed">
              {scoreExplanations.starStructure.explanation}
            </p>
          </div>
        )}

        {scoreExplanations.frameworkRules && (
          <div className="rounded-xl border border-slate-100 p-4">
            <h4 className="font-semibold text-slate-800">Framework Scoring Rules</h4>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {scoreExplanations.frameworkRules.explanation}
            </p>
            {scoreExplanations.frameworkRules.turnLevelBreakdowns?.length ? (
              <div className="mt-4 space-y-2">
                {scoreExplanations.frameworkRules.turnLevelBreakdowns.map((turn, index) => (
                  <div key={turn.turnId || index} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <span className="font-semibold">{turn.frameworkLabel || formatKey(turn.frameworkKey) || `Answer ${index + 1}`}</span>
                    <span> · {Number(turn.score || 0)}/10</span>
                    {turn.mainGapKey ? <span> · Main gap: {formatKey(turn.mainGapKey)}</span> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Limitations */}
        {scoreLimitations && scoreLimitations.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">Scoring Limitations</h5>
            <ul className="list-disc pl-5 space-y-1 text-xs text-slate-500">
              {scoreLimitations.map((limit, idx) => (
                <li key={idx}>{limit}</li>
              ))}
            </ul>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
