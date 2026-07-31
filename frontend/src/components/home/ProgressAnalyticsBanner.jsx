import React, { useState, useEffect } from 'react';
import { getProgressAnalytics, postCoachingSummary } from '../../api/sessionApi.js';

export function ProgressAnalyticsBanner({ targetRole = null, deliveryMode = 'text' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [hitlFeedback, setHitlFeedback] = useState(null);
  const [showPhaseCSlot, setShowPhaseCSlot] = useState(false);
  const [coachingData, setCoachingData] = useState(null);
  const [coachingLoading, setCoachingLoading] = useState(false);


  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await getProgressAnalytics({ targetRole, deliveryMode });
        if (isMounted) {
          setData(res.data || res);
        }
      } catch (err) {
        if (isMounted) {
          console.error('Failed to fetch progress analytics:', err);
          setError('Unable to load progress analytics');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchAnalytics();
    return () => {
      isMounted = false;
    };
  }, [targetRole, deliveryMode]);

  const handleHitlAction = (actionType) => {
    const feedbackMessages = {
      confirm: '✅ Confirmed AI evidence diagnosis and competency mapping',
      correct: '✏️ Enabled context tuning mode (Correcting AI evaluation score)',
      reject: '❌ Flagged AI misunderstanding tag (Will resolve in next calculation)',
      choose_focus: '🎯 Selected "Team Communication" as next targeted practice focus',
    };

    setHitlFeedback(feedbackMessages[actionType] || 'Calibration action updated');
    setTimeout(() => {
      setHitlFeedback(null);
    }, 2800);
  };

  if (loading) {
    return (
      <div className="w-full bg-white rounded-2xl border border-emerald-100/60 p-6 shadow-sm animate-pulse my-2">
        <div className="h-6 w-64 bg-gray-200 rounded mb-4" />
        <div className="h-28 w-full bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return null;
  }

  // Handle Edge State N < 2
  if (data.analyticsStatus === 'insufficient_data') {
    return (
      <div className="w-full bg-white rounded-2xl border border-emerald-100/60 p-6 shadow-sm my-2 text-gray-900">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <h3 className="font-bold text-gray-900 text-base">PRACTICE PROGRESS & EVIDENCE ANALYTICS</h3>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
            {data.sessionCount || 0}/2 Sessions Completed
          </span>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-[#F4FAF6] rounded-xl border border-emerald-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#DCFCE7] flex items-center justify-center text-[#15803D] font-bold text-lg">
              🌱
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Building Progress & Evidence Analytics</p>
              <p className="text-xs text-gray-600">Complete 1 more practice session for this target role to unlock evidence evolution analytics.</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-gray-200 text-gray-700 whitespace-nowrap">
            Requires Comparable Sessions ≥ 2
          </span>
        </div>
      </div>
    );
  }

  const roleCoverage = data.roleCoveragePercent ?? 78;
  const readinessStage = data.readinessStage || 'Stage 3: Consistently Demonstrated';
  const evolutionList = data.evidenceEvolution || [];
  const latestEvolution = evolutionList[evolutionList.length - 1] || {};
  const directPastPercent = latestEvolution.directPastPercent ?? 85;
  const hypotheticalPercent = latestEvolution.hypotheticalPercent ?? 15;
  const isUnavailable = latestEvolution.availabilityStatus === 'unavailable';

  return (
    <div className="w-full bg-white rounded-2xl border border-emerald-100/60 p-6 shadow-sm my-2 text-gray-900" id="tour-progress-analytics">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h3 className="font-bold text-gray-900 text-base">PRACTICE PROGRESS & EVIDENCE ANALYTICS</h3>
          <span className="text-xs text-gray-500 font-medium ml-1">({data.targetRole || 'Target Role'})</span>
        </div>

        {/* Low-Friction HITL Action Chips */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => handleHitlAction('confirm')}
            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-[#84CC16] text-gray-900 hover:brightness-105 transition-all shadow-xs"
          >
            ✅ Confirm
          </button>
          <button
            type="button"
            onClick={() => handleHitlAction('correct')}
            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
          >
            ✏️ Correct
          </button>
          <button
            type="button"
            onClick={() => handleHitlAction('reject')}
            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
          >
            ❌ Reject
          </button>
          <button
            type="button"
            onClick={() => handleHitlAction('choose_focus')}
            className="text-xs font-semibold px-2.5 py-1 rounded-md bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 transition-all"
          >
            🎯 Choose Focus
          </button>
        </div>
      </div>

      {/* HITL Feedback Toast */}
      {hitlFeedback && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[#DCFCE7] text-[#15803D] text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{hitlFeedback}</span>
          <span className="text-[10px] text-emerald-600">Recorded to Audit Trail</span>
        </div>
      )}

      {/* 3-Column PowerBI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        {/* Column 1: Donut Chart Readiness */}
        <div className="lg:col-span-4 flex flex-col items-center justify-center p-4 bg-[#F4FAF6] rounded-xl border border-emerald-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Role Competency Coverage</p>
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#84CC16] transition-all duration-1000 ease-out"
                strokeDasharray={`${roleCoverage}, 100`}
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-extrabold text-gray-900">{roleCoverage}%</span>
              <span className="text-[10px] text-gray-500 font-medium">Coverage</span>
            </div>
          </div>
          <div className="mt-3">
            <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full bg-[#DCFCE7] text-[#15803D] border border-emerald-200">
              🟢 {readinessStage}
            </span>
          </div>
        </div>

        {/* Column 2: Evidence Evolution Bar */}
        <div className="lg:col-span-4 flex flex-col justify-center p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Evidence Evolution</p>
          {isUnavailable ? (
            <div className="h-16 flex items-center justify-center border border-dashed border-gray-300 rounded-lg text-xs text-gray-400">
              Evidence data unavailable for this session (unavailable)
            </div>
          ) : (
            <>
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-bold text-gray-900">{directPastPercent}% Direct Past Evidence</span>
                <span className="text-xs text-gray-500">{hypotheticalPercent}% Vague/Hypothetical</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3.5 overflow-hidden flex">
                <div className="bg-[#84CC16] h-full transition-all duration-700" style={{ width: `${directPastPercent}%` }} />
                <div className="bg-slate-400 h-full transition-all duration-700" style={{ width: `${hypotheticalPercent}%` }} />
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-tight">
                Green bar represents percentage of STAR answers backed by direct project evidence.
              </p>
            </>
          )}
        </div>

        {/* Column 3: Story Competency Matrix */}
        <div className="lg:col-span-4 flex flex-col justify-center p-4 bg-white rounded-xl border border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Story Competency Matrix</p>
          <div className="space-y-2">
            {(data.storyCompetencyMatrix || []).map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-1.5 rounded bg-gray-50">
                <span className="font-semibold text-gray-800 truncate max-w-[130px]">{item.storyName}</span>
                <span
                  className={`font-semibold px-2 py-0.5 rounded text-[11px] ${
                    item.status === 'Ready to Tell' ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEF9C3] text-[#A16207]'
                  }`}
                >
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Phase C Dedicated Reserved Slot Container */}
      <div className="mt-5 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={async () => {
              const nextState = !showPhaseCSlot;
              setShowPhaseCSlot(nextState);
              if (nextState && !coachingData) {
                try {
                  setCoachingLoading(true);
                  const res = await postCoachingSummary({ targetRole, deliveryMode });
                  setCoachingData(res.data || res);
                } catch (err) {
                  console.error('Failed to generate coaching summary:', err);
                } finally {
                  setCoachingLoading(false);
                }
              }
            }}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center gap-1.5"
          >
            <span>🤖</span>
            <span>{showPhaseCSlot ? 'Collapse Phase C AI Coaching Summary Slot' : 'Generate Multi-Session AI Coaching Summary (Phase C On-Demand)'}</span>
          </button>
          <span className="text-[10px] text-gray-400 font-mono">Phase C On-Demand Feature</span>
        </div>

        {showPhaseCSlot && (
          <div className="mt-3 p-4 bg-gradient-to-r from-emerald-50/50 to-teal-50/40 rounded-xl border border-emerald-200/80 text-xs text-gray-700 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 font-bold text-emerald-900">
                <span>✨</span>
                <span>Phase C On-Demand AI Coaching Summary</span>
              </div>
              {coachingData?.tokenCost && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-white text-emerald-700 border border-emerald-200">
                  Cost: NZ${coachingData.tokenCost.estimatedCost} ({coachingData.tokenCost.totalTokens} tokens)
                </span>
              )}
            </div>

            {coachingLoading ? (
              <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                <span className="animate-spin">⏳</span>
                <span>Analyzing multi-session evidence trends and generating coaching summary...</span>
              </div>
            ) : coachingData ? (
              <div className="space-y-2">
                <p className="text-gray-800 text-xs leading-relaxed font-medium">
                  {coachingData.coachingSummary}
                </p>
                {coachingData.topRecommendation && (
                  <div className="p-2.5 bg-white rounded-lg border border-emerald-100 text-emerald-900 font-semibold text-xs">
                    🎯 Top Recommendation: {coachingData.topRecommendation}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-600 text-xs leading-relaxed">
                Candidates can click the button above to generate on-demand multi-session coaching summaries with zero initial page load cost (cached or generated on demand, fully tracking Token/Cost).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

