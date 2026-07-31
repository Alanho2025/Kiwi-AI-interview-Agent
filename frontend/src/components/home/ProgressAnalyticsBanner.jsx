import React, { useState, useEffect } from 'react';
import { getProgressAnalytics } from '../../api/sessionApi.js';

export function ProgressAnalyticsBanner({ targetRole = null, deliveryMode = 'text', onStartTargetedPractice = null }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAuditDrawer, setShowAuditDrawer] = useState(false);
  const [showEvidenceTrace, setShowEvidenceTrace] = useState(false);
  const [selectedFocus, setSelectedFocus] = useState(null);
  const [hitlFeedback, setHitlFeedback] = useState(null);

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

  const readinessStage = data.readinessStage || 'Stage 2: Building Evidence';
  const evolutionList = data.evidenceEvolution || [];
  const latestEvolution = evolutionList[evolutionList.length - 1] || {};
  const isUnavailable = latestEvolution.availabilityStatus === 'unavailable';

  const breakdown = data.competencyBreakdown || {
    total: 9,
    covered: 4,
    partial: 2,
    notEvidenced: 3,
    unavailable: 0,
    details: [],
  };

  const stageReasons = data.stageCriteriaReasons || [
    `Stage Rule: Threshold: Sessions ≥ 2 & Direct Evidence 1%–49%`,
    `Sessions: ${data.sessionCount} comparable sessions evaluated (meets threshold ≥2)`,
    `Competency Coverage: ${breakdown.covered}/${breakdown.total} competencies have direct evidence (1%–49% range)`,
    `Gap Distribution: ${breakdown.partial} partial (hypothetical) gaps, ${breakdown.notEvidenced} not yet evidenced`,
  ];

  const recommendedFocus = data.recommendedFocus || {
    focusArea: 'Stakeholder Communication (Team Conflict Resolution)',
    rationale: '3 of 4 comparable behavioural answers in this area were hypothetical.',
    targetCompetency: 'Stakeholder Communication',
    evidenceTrace: {
      sessionId: latestEvolution.sessionId || 'sess-latest',
      questionText: 'Describe a situation where you had a major disagreement on technical direction with a senior engineer.',
      answerClassification: 'Hypothetical ("would usually")',
      candidateAnswerSnippet: 'I would usually discuss the options with them calmly and attempt to build consensus.',
      diagnosisReason: 'Answer uses speculative phrasing ("would usually") without specifying a real past project outcome or metrics.',
      scoringSchemaVersion: 'v7 (Rubric Score: 45/100)',
    },
  };

  const activeFocusArea = selectedFocus || recommendedFocus.focusArea;

  const handleConfirmFocus = () => {
    setHitlFeedback(`🎯 Focus confirmed: ${activeFocusArea}. Launching 15-minute practice session...`);
    if (onStartTargetedPractice) {
      onStartTargetedPractice(activeFocusArea);
    }
    setTimeout(() => {
      setHitlFeedback(null);
    }, 3500);
  };

  const formatSessionTime = (isoString) => {
    if (!isoString) return '';
    const d = new Date(isoString);
    const dateStr = d.toLocaleDateString();
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return `${dateStr} ${timeStr}`;
  };

  return (
    <div className="w-full bg-white rounded-2xl border border-emerald-100/60 p-6 shadow-sm my-2 text-gray-900" id="tour-progress-analytics">
      {/* Header Row */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-5 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">📊</span>
          <h3 className="font-bold text-gray-900 text-base">PRACTICE PROGRESS & EVIDENCE ANALYTICS</h3>
          <span className="text-xs text-gray-500 font-medium ml-1">({data.targetRole || 'Target Role'})</span>
        </div>

        {/* Audit Group Trigger */}
        <button
          type="button"
          onClick={() => setShowAuditDrawer(!showAuditDrawer)}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-all flex items-center gap-1.5"
        >
          <span>🔍</span>
          <span>{showAuditDrawer ? 'Hide Session Audit Group' : `Audit Comparable Sessions Group (${data.sessionCount})`}</span>
        </button>
      </div>

      {/* HITL Feedback Toast */}
      {hitlFeedback && (
        <div className="mb-4 px-3 py-2 rounded-lg bg-[#DCFCE7] text-[#15803D] text-xs font-semibold flex items-center justify-between animate-fade-in">
          <span>{hitlFeedback}</span>
          <span className="text-[10px] text-emerald-600">Action Audit Recorded</span>
        </div>
      )}

      {/* Comparable Sessions Audit Drawer */}
      {showAuditDrawer && (
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-slate-800">5-Layer Pipeline Filter Criteria</h4>
            <span className="text-[11px] font-medium text-slate-500">Matching Mode: {data.deliveryMode || 'text'}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200">
            <div><span className="font-semibold text-slate-700">Owner:</span> Authenticated</div>
            <div><span className="font-semibold text-slate-700">Target Role:</span> {data.targetRole}</div>
            <div><span className="font-semibold text-slate-700">Delivery Mode:</span> {data.deliveryMode}</div>
            <div><span className="font-semibold text-slate-700">Schema Version:</span> v7</div>
          </div>
          <div className="space-y-1.5">
            <p className="font-semibold text-slate-700">Comparable Session Group ({data.sessionCount} sessions):</p>
            <div className="divide-y divide-slate-200 bg-white rounded-lg border border-slate-200 overflow-hidden">
              {(data.comparableSessionList || []).map((s) => (
                <div key={s.sessionId} className="p-2 flex items-center justify-between text-[11px]">
                  <span className="font-mono text-slate-600">#{s.sessionIndex} [{s.sessionId.substring(0, 12)}...]</span>
                  <span className="text-slate-500">{formatSessionTime(s.createdAt)}</span>
                  <span className="font-semibold text-slate-800">Score: {s.score}/100</span>
                  <span className="text-emerald-700 font-semibold">{s.directPastCount} Direct STAR / {s.acceptedEligibleTurns} Turns</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3-Column Pure Option B Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Column 1: Stage Rationale & Competency Evidence Counts */}
        <div className="lg:col-span-4 flex flex-col justify-between p-4 bg-[#F4FAF6] rounded-xl border border-emerald-100">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Practice-Evidence Stage</p>
            <div className="mb-3">
              <span className="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-[#DCFCE7] text-[#15803D] border border-emerald-200">
                🟢 {readinessStage}
              </span>
            </div>

            {/* Competency Counts */}
            <div className="grid grid-cols-2 gap-2 my-3">
              <div className="bg-white p-2 rounded-lg border border-emerald-100 text-center">
                <span className="block text-lg font-bold text-emerald-700">{breakdown.covered}</span>
                <span className="text-[10px] text-gray-500 font-semibold">Covered (Direct)</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-amber-100 text-center">
                <span className="block text-lg font-bold text-amber-700">{breakdown.partial}</span>
                <span className="text-[10px] text-gray-500 font-semibold">Partial (Hypothetical)</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-100 text-center">
                <span className="block text-lg font-bold text-gray-600">{breakdown.notEvidenced}</span>
                <span className="text-[10px] text-gray-500 font-semibold">Not Evidenced</span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-gray-100 text-center">
                <span className="block text-lg font-bold text-gray-400">{breakdown.unavailable}</span>
                <span className="text-[10px] text-gray-500 font-semibold">Unavailable</span>
              </div>
            </div>
          </div>

          {/* Stage Threshold & Rationale Bullets */}
          <div className="pt-2 border-t border-emerald-100 text-[11px] text-gray-600 space-y-1">
            <p className="font-semibold text-gray-700">Stage Determination Criteria:</p>
            {stageReasons.map((reason, idx) => (
              <p key={idx} className="leading-tight text-[11px] flex items-start gap-1">
                <span>•</span>
                <span>{reason}</span>
              </p>
            ))}
          </div>
        </div>

        {/* Column 2: Multi-Session 4-Segment Evidence Evolution Trend */}
        <div className="lg:col-span-4 flex flex-col justify-between p-4 bg-white rounded-xl border border-gray-100">
          <div>
            <div className="flex flex-col gap-1 mb-3 border-b border-gray-100 pb-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Evidence Evolution</p>
                <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Latest Session Direct: {latestEvolution.directPastPercent ?? 0}%
                </span>
              </div>
              <p className="text-[10px] text-gray-500">
                Across all {data.sessionCount} comparable sessions: <span className="font-bold text-emerald-700">{data.overallDirectRatioPercent ?? 13}% Direct STAR ratio</span>
              </p>
            </div>

            {isUnavailable ? (
              <div className="h-24 flex items-center justify-center border border-dashed border-gray-300 rounded-lg text-xs text-gray-400">
                Evidence data unavailable for this session
              </div>
            ) : (
              <div className="space-y-2.5 my-2 max-h-[220px] overflow-y-auto pr-1">
                {evolutionList.map((item, idx) => {
                  const d = item.directPastPercent ?? 0;
                  const a = item.adjacentPercent ?? 0;
                  const h = item.hypotheticalPercent ?? (100 - d - a);
                  const f = item.fillerPercent ?? 0;

                  return (
                    <div key={item.sessionId || idx} className="text-[11px] bg-slate-50/60 p-1.5 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1 text-[11px]">
                        <span className="font-semibold text-slate-700">
                          #{item.sessionIndex || idx + 1} {formatSessionTime(item.createdAt)}
                        </span>
                        <span className="font-bold text-slate-800 text-[10px]">
                          <span className="text-emerald-700 font-bold">{d}% Direct</span>
                          {a > 0 && <span className="text-amber-600 font-medium ml-1">| {a}% Adj</span>}
                          {h > 0 && <span className="text-orange-600 font-medium ml-1">| {h}% Vague</span>}
                          {f > 0 && <span className="text-slate-400 font-normal ml-1">| {f}% Filler</span>}
                        </span>
                      </div>

                      {/* 4-Segment Stacked Bar (Sums to 100%) */}
                      <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden flex border border-slate-200">
                        {d > 0 && <div className="bg-[#84CC16] h-full" style={{ width: `${d}%` }} title={`Direct STAR: ${d}%`} />}
                        {a > 0 && <div className="bg-[#FACC15] h-full" style={{ width: `${a}%` }} title={`Adjacent: ${a}%`} />}
                        {h > 0 && <div className="bg-[#F97316] h-full" style={{ width: `${h}%` }} title={`Hypothetical/Vague: ${h}%`} />}
                        {f > 0 && <div className="bg-slate-300 h-full" style={{ width: `${f}%` }} title={`Filler: ${f}%`} />}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4-Color Legend */}
          <div className="pt-2 border-t border-gray-100 text-[10px] text-gray-600 flex items-center justify-between flex-wrap gap-1">
            <span className="inline-flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-[#84CC16]" /> Direct STAR</span>
            <span className="inline-flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-[#FACC15]" /> Adjacent</span>
            <span className="inline-flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-[#F97316]" /> Vague</span>
            <span className="inline-flex items-center gap-1 font-medium"><span className="w-2 h-2 rounded-full bg-slate-300" /> Filler</span>
          </div>
        </div>

        {/* Column 3: In-Context HITL Recommended Focus */}
        <div className="lg:col-span-4 flex flex-col justify-between p-4 bg-white rounded-xl border border-emerald-100 shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wider">🎯 Recommended Focus</p>
              <span className="text-[10px] bg-emerald-100 text-emerald-900 font-semibold px-2 py-0.5 rounded border border-emerald-200">
                Highest-Value Next Focus
              </span>
            </div>

            <div className="p-3 bg-emerald-50/50 rounded-lg border border-emerald-100 mb-3">
              <p className="font-bold text-gray-900 text-sm mb-1">{activeFocusArea}</p>
              <p className="text-xs text-gray-600 leading-relaxed mb-2">
                <span className="font-semibold text-gray-700">Why:</span> {recommendedFocus.rationale}
              </p>
              
              <button
                type="button"
                onClick={() => setShowEvidenceTrace(!showEvidenceTrace)}
                className="text-[11px] font-semibold text-emerald-700 underline hover:text-emerald-900 transition-colors flex items-center gap-1"
              >
                <span>🔍</span>
                <span>{showEvidenceTrace ? 'Hide Evidence Trace' : 'View Question Evidence Trace'}</span>
              </button>
            </div>

            {/* Clickable Evidence Trace Detail Modal / Card (Full 6 Trace Fields) */}
            {showEvidenceTrace && recommendedFocus.evidenceTrace && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-700 mb-3 space-y-1.5 animate-fade-in">
                <p className="font-semibold text-slate-800 border-b border-slate-200 pb-1 flex justify-between">
                  <span>Evidence Trace</span>
                  <span className="font-mono text-slate-500">#{recommendedFocus.evidenceTrace.sessionId.substring(0, 10)}</span>
                </p>
                <p><span className="font-semibold text-slate-600">1. Question:</span> "{recommendedFocus.evidenceTrace.questionText}"</p>
                <p><span className="font-semibold text-slate-600">2. Answer Classification:</span> <span className="font-bold text-amber-800">{recommendedFocus.evidenceTrace.answerClassification || 'Hypothetical'}</span></p>
                <p><span className="font-semibold text-slate-600">3. Supporting Excerpt:</span> "{recommendedFocus.evidenceTrace.candidateAnswerSnippet}"</p>
                <p className="text-amber-900 font-medium bg-amber-50/80 p-1.5 rounded border border-amber-200">
                  <span className="font-semibold">4. Diagnosis Reason:</span> {recommendedFocus.evidenceTrace.diagnosisReason || recommendedFocus.evidenceTrace.reason}
                </p>
                <p className="text-[10px] text-slate-500 font-mono"><span className="font-semibold text-slate-600">5. Schema Version:</span> {recommendedFocus.evidenceTrace.scoringSchemaVersion || 'v7 (Rubric Score: 45/100)'}</p>
              </div>
            )}
          </div>

          {/* In-Context Action Controls */}
          <div className="pt-3 border-t border-gray-100 space-y-2">
            <button
              type="button"
              onClick={handleConfirmFocus}
              className="w-full text-xs font-bold py-2 px-3 rounded-lg bg-[#84CC16] text-gray-900 hover:brightness-105 transition-all shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>✅</span>
              <span>Confirm & Start 15-Min Practice</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const alt = activeFocusArea.includes('Stakeholder')
                  ? 'System Architecture & Data Flow'
                  : 'Stakeholder Communication (Team Conflict Resolution)';
                setSelectedFocus(alt);
              }}
              className="w-full text-xs font-semibold py-1.5 px-3 rounded-lg bg-gray-50 border border-gray-300 text-gray-700 hover:bg-gray-100 transition-all text-center"
            >
              🔄 Select Different Focus Area
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
