import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';

function ScoreBar({ label, score, colorClass }) {
  // Score is 0-10
  const percentage = Math.max(0, Math.min(100, (score / 10) * 100));
  
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-gray-500 font-medium">{label}</span>
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-500`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right font-semibold text-gray-700">{score}/10</span>
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
        <p className="text-sm text-gray-500 mt-1">Detailed feedback and scoring for each of your key answers.</p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {turnBreakdowns.map((turn, index) => {
            const isExpanded = expandedIndex === index;
            
            return (
              <div 
                key={index} 
                className={`overflow-hidden rounded-2xl border transition-all duration-200 ${
                  isExpanded ? 'border-indigo-200 bg-white shadow-md' : 'border-gray-100 bg-gray-50 hover:border-gray-200 cursor-pointer'
                }`}
                onClick={() => !isExpanded && setExpandedIndex(index)}
              >
                {/* Header (Always visible) */}
                <div className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-start gap-2">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                        Q{index + 1}
                      </span>
                      <h4 className="min-w-0 break-words text-sm font-semibold text-gray-900 line-clamp-2">{turn.question}</h4>
                    </div>
                  </div>
                  
                  {/* Chevron icon */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedIndex(isExpanded ? -1 : index);
                    }}
                    className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-200"
                  >
                    <svg 
                      className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-5 pt-2 border-t border-indigo-50 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200">
                    
                    {/* Scores */}
                    {turn.scores && (
                      <div className="bg-slate-50 rounded-xl p-4 space-y-3 border border-slate-100">
                        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Micro-Scores</h5>
                        <ScoreBar label="Business" score={turn.scores.business} colorClass="bg-blue-500" />
                        <ScoreBar label="Logic" score={turn.scores.logic} colorClass="bg-purple-500" />
                        <ScoreBar label="Evidence" score={turn.scores.evidence} colorClass="bg-emerald-500" />
                      </div>
                    )}

                    {/* Answer Summary */}
                    <div>
                      <h5 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2">Your Answer Summary</h5>
                      <p className="text-sm text-gray-700 leading-relaxed bg-gray-50 p-3 rounded-lg border border-gray-100">
                        {turn.answer}
                      </p>
                    </div>

                    {/* Coach Feedback */}
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
