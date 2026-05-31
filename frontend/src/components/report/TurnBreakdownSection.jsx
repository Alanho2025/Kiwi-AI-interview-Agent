import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

const clampMicroScore = (score = 0) => Math.max(0, Math.min(10, Number(score || 0)));

const buildDimensionReason = ({ label, score, turn = {} }) => {
  const normalizedLabel = label.toLowerCase();
  const explicitReasons = turn.scoreReasons || turn.dimensionReasons || turn.scores?.reasons || {};
  const explicit = explicitReasons[normalizedLabel] || explicitReasons[label] || explicitReasons[`${normalizedLabel}Reason`];
  if (explicit) return explicit;

  const safeScore = clampMicroScore(score);
  const answer = String(turn.answer || turn.answerSummary || '').trim();
  const feedback = String(turn.feedback || '').trim();

  if (normalizedLabel === 'business') {
    if (safeScore >= 8) return 'Strong role awareness. The answer connects the work to user, business, or delivery value.';
    if (safeScore >= 6) return 'Some business context is present, but the answer could link impact to the target role more clearly.';
    return 'Business value is unclear. Add who benefited, what changed, and why it mattered.';
  }

  if (normalizedLabel === 'logic') {
    if (turn.starApplicable === false) {
      if (turn.rubricType === 'self_intro') return 'Scored from introduction flow, role interest, and clarity.';
      if (turn.rubricType === 'company_motivation') return 'Scored from company reason, role reason, and candidate evidence.';
      return 'Scored from answer relevance, clarity, and completion.';
    }
    if (safeScore >= 8) return 'The answer has a clear structure and is easy to follow.';
    if (safeScore >= 6) return 'The structure is understandable, but the steps could be sharper and less general.';
    return 'The answer needs a clearer setup, action, and result sequence.';
  }

  if (safeScore >= 8) return 'The answer uses concrete evidence, not just claims.';
  if (safeScore >= 6) return feedback || 'Some evidence appears, but it needs stronger proof or a measurable result.';
  if (answer.length < 80) return 'Evidence is thin. Add a real example, your action, and a result metric.';
  return 'The answer explains intent, but it needs more proof from a real project or work example.';
};

function ScoreBar({ label, score, colorClass, reason }) {
  const safeScore = clampMicroScore(score);
  const percentage = (safeScore / 10) * 100;
  
  return (
    <div className="rounded-xl border border-slate-100 glass p-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="w-20 shrink-0 text-faint font-medium">{label}</span>
        <div className="flex-1 h-2 bg-chip rounded-full overflow-hidden">
          <div 
            className={`h-full ${colorClass} transition-all duration-500`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="w-8 shrink-0 text-right font-semibold text-muted">{safeScore}/10</span>
      </div>
      <p className="mt-2 pl-0 text-xs leading-5 text-slate-600 sm:pl-20">{reason}</p>
    </div>
  );
}

function TrustMeta({ turn }) {
  if (!turn?.evidenceLabel && !turn?.confidenceLevel && !turn?.feedbackStatus) return null;
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      {turn.evidenceLabel ? <span className="rounded-full bg-white px-2.5 py-1 font-medium text-indigo-800">{turn.evidenceLabel}</span> : null}
      {turn.confidenceLevel ? <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700">{turn.confidenceLevel} confidence</span> : null}
      {turn.feedbackStatus ? <span className="rounded-full bg-white px-2.5 py-1 font-medium text-slate-700">{turn.feedbackStatus}</span> : null}
      {turn.needsUserConfirmation ? <span className="rounded-full bg-amber-100 px-2.5 py-1 font-medium text-amber-900">needs confirmation</span> : null}
      {turn.evidenceReason ? <p className="basis-full pt-1 leading-5 text-slate-600">{turn.evidenceReason}</p> : null}
    </div>
  );
}

function StructureBreakdown({ turn }) {
  const breakdown = turn.structureBreakdown || turn.starrBreakdown || turn.starBreakdown;
  if (!breakdown) return null;
  if (turn.starApplicable === false) {
    const entries = Object.entries(breakdown)
      .filter(([key, value]) => !['scores', 'mainMissingElement', 'scoreReason', 'totalScore', 'maxScore'].includes(key) && typeof value === 'string');
    return (
      <div className="rounded-xl border border-slate-100 bg-white/70 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{turn.structureLabel || 'Answer Structure'}</h5>
          {breakdown.mainMissingElement ? <p className="text-xs text-slate-500">Main gap: {breakdown.mainMissingElement}</p> : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {entries.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label.replace(/([A-Z])/g, ' $1')}</p>
              <p className="mt-1 text-sm font-medium text-slate-800">{value || 'missing'}</p>
            </div>
          ))}
        </div>
        {breakdown.scoreReason ? <p className="mt-3 text-xs leading-5 text-slate-600">{breakdown.scoreReason}</p> : null}
      </div>
    );
  }
  const starBreakdown = turn.starrBreakdown || turn.starBreakdown;
  if (!starBreakdown) return null;
  const parts = [
    ['Situation', starBreakdown.situation],
    ['Task', starBreakdown.task],
    ['Action', starBreakdown.action],
    [turn.resultOrReactionLabel || 'Result', starBreakdown.resultOrReaction || starBreakdown.result],
  ];
  if (starBreakdown.reflection) {
    parts.push(['Reflection', starBreakdown.reflection]);
  }
  
  const gridCols = parts.length === 5 ? 'sm:grid-cols-5' : 'sm:grid-cols-4';

  return (
    <div className="rounded-xl border border-slate-100 bg-white/70 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">STARR Evidence</h5>
        {starBreakdown.mainMissingElement ? <p className="text-xs text-slate-500">Main gap: {starBreakdown.mainMissingElement}</p> : null}
      </div>
      <div className={`mt-3 grid gap-2 ${gridCols}`}>
        {parts.map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-1 text-sm font-medium text-slate-800">{value || 'missing'}</p>
          </div>
        ))}
      </div>
      {starBreakdown.scoreReason ? <p className="mt-3 text-xs leading-5 text-slate-600">{starBreakdown.scoreReason}</p> : null}
    </div>
  );
}

export function TurnBreakdownSection({ turnBreakdowns }) {
  const [expandedIndex, setExpandedIndex] = useState(0);

  if (!turnBreakdowns || turnBreakdowns.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Turn-by-Turn Breakdown</CardTitle>
        <p className="text-sm text-faint mt-1">Detailed feedback and scoring for each of your key answers.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {turnBreakdowns.map((turn, index) => {
            const isExpanded = expandedIndex === index;
            
            return (
              <div 
                key={index} 
                className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isExpanded ? 'border-indigo-200 glass shadow-md' : 'border-gray-100 bg-transparent hover:border-theme cursor-pointer'
                }`}
                onClick={() => !isExpanded && setExpandedIndex(index)}
              >
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        Q{index + 1}
                      </span>
                      <h4 className="min-w-0 break-words text-sm font-semibold text-primary line-clamp-2">{turn.question}</h4>
                    </div>
                  </div>
                  
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIndex(isExpanded ? -1 : index);
                    }}
                    className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-chip"
                    aria-label={isExpanded ? 'Collapse turn feedback' : 'Expand turn feedback'}
                  >
                    <svg 
                      className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-5 pt-2 border-t border-indigo-50 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                    {turn.scores && (
                      <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                          <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Micro-Scores</h5>
                          <p className="text-xs text-slate-500">Each score explains what helped and what was missing.</p>
                        </div>
                        <ScoreBar
                          label="Business"
                          score={turn.scores.business}
                          colorClass="bg-blue-500"
                          reason={buildDimensionReason({ label: 'business', score: turn.scores.business, turn })}
                        />
                        <ScoreBar
                          label="Logic"
                          score={turn.scores.logic}
                          colorClass="bg-purple-500"
                          reason={buildDimensionReason({ label: 'logic', score: turn.scores.logic, turn })}
                        />
                        <ScoreBar
                          label="Evidence"
                          score={turn.scores.evidence}
                          colorClass="bg-emerald-500"
                          reason={buildDimensionReason({ label: 'evidence', score: turn.scores.evidence, turn })}
                        />
                      </div>
                    )}

                    <StructureBreakdown turn={turn} />
                    <TrustMeta turn={turn} />

                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-faint mb-2">Your Answer Summary</h5>
                      <p className="text-sm text-muted leading-relaxed bg-transparent p-3 rounded-lg border border-gray-100">
                        {turn.answer}
                      </p>
                    </div>

                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-indigo-600 mb-2">Coach's Feedback</h5>
                      <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/50">
                        <p className="text-sm text-indigo-900 leading-relaxed">
                          {turn.feedback}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
