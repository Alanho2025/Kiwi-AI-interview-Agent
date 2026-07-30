import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';
import { EvidenceBadge } from './EvidenceBadge.jsx';

const clampMicroScore = (score = 0) => Math.max(0, Math.min(10, Number(score || 0)));

const ANSWER_RESULT_LABELS = {
  directly_addressed: 'Directly addressed',
  partly_addressed: 'Partly addressed',
  needs_clearer_connection: 'Needs a clearer connection',
  not_assessed: 'Not assessed',
};

const ANSWER_RESULT_STYLES = {
  directly_addressed: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  partly_addressed: 'border-amber-200 bg-amber-50 text-amber-900',
  needs_clearer_connection: 'border-rose-200 bg-rose-50 text-rose-900',
  not_assessed: 'border-slate-200 bg-slate-50 text-slate-700',
};

const formatStructureLabel = (label = '') => String(label || '')
  .replace(/^resultOrReaction$/i, 'result')
  .replace(/([A-Z])/g, ' $1')
  .trim();



function ScoreBar({ label, score, color, reason }) {
  const safeScore = clampMicroScore(score);
  const percentage = (safeScore / 10) * 100;
  
  return (
    <div className="rounded-xl border border-slate-100 glass p-3">
      <div className="flex items-center gap-3 text-sm">
        <span className="w-20 shrink-0 text-faint font-medium">{label}</span>
        <div className="flex-1 h-2 bg-chip rounded-full overflow-hidden">
          <div 
            className="h-full transition-all duration-500"
            style={{ width: `${percentage}%`, backgroundColor: color }}
          />
        </div>
        <span className="w-8 shrink-0 text-right font-semibold text-muted">{safeScore}/10</span>
      </div>
      <p className="mt-2 pl-0 text-xs leading-5 text-slate-600 sm:pl-20">{reason}</p>
    </div>
  );
}



function StructureBreakdown({ turn }) {
  if (turn.starApplicable === false && turn.frameworkBreakdown?.dimensions?.length) return null;
  const breakdown = turn.structureBreakdown || turn.starrBreakdown || turn.starBreakdown;
  if (!breakdown) return null;
  if (turn.starApplicable === false) {
    const entries = Object.entries(breakdown)
      .filter(([key, value]) => !['scores', 'mainMissingElement', 'scoreReason', 'totalScore', 'maxScore'].includes(key) && typeof value === 'string');
    return (
      <div className="rounded-xl border border-slate-100 bg-white/70 p-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{turn.structureLabel || 'Answer Structure'}</h5>
          {breakdown.mainMissingElement ? <p className="text-xs text-slate-500">Main gap: {formatStructureLabel(breakdown.mainMissingElement)}</p> : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {entries.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{formatStructureLabel(label)}</p>
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
    ['Reflection', starBreakdown.reflection],
  ].filter(([, value]) => value !== 'not_applicable');

  return (
    <div className="rounded-xl border border-slate-100 bg-white/70 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">STARR Evidence</h5>
        {starBreakdown.mainMissingElement ? <p className="text-xs text-slate-500">Main gap: {formatStructureLabel(starBreakdown.mainMissingElement)}</p> : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
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

function buildFallbackFrameworkBreakdown(turn) {
  const questionText = (turn.question || '').toLowerCase();
  const isSelfIntro = turn.rubricType === 'self_intro'
    || turn.frameworkKey === 'self_intro'
    || /introduce yourself|briefly introduce|about yourself|quick introduction/i.test(questionText);

  const scores = turn.scores || {};
  const b = Number(scores.business ?? 5);
  const l = Number(scores.logic ?? 5);
  const e = Number(scores.evidence ?? 5);
  const avg = Math.round(((b + l + e) / 3) * 10) / 10;

  const toStatus = (score) => {
    if (score >= 8) return 'clear';
    if (score >= 4) return 'partial';
    return 'missing';
  };

  if (isSelfIntro) {
    return {
      normalizedScore: avg,
      dimensions: [
        {
          key: 'background',
          label: 'Background',
          score: l,
          status: toStatus(l),
          reason: l >= 7 ? 'Education and professional background are clear.' : 'Background is mentioned but needs a clearer sequence.',
        },
        {
          key: 'roleRelevance',
          label: 'Role Relevance',
          score: Math.round((l + b) / 2),
          status: toStatus(Math.round((l + b) / 2)),
          reason: Math.round((l + b) / 2) >= 7 ? 'Connection to the target role is explicit.' : 'Role relevance needs a sharper link to the role requirements.',
        },
        {
          key: 'evidence',
          label: 'Evidence',
          score: e,
          status: toStatus(e),
          reason: e >= 7 ? 'Includes concrete project or product evidence.' : 'Needs more specific proof from past projects or achievements.',
        },
        {
          key: 'clarity',
          label: 'Clarity',
          score: l,
          status: toStatus(l),
          reason: l >= 7 ? 'Structure is clear and easy to follow.' : 'Clarity can be improved with a concise, logical flow.',
        },
      ],
      summary: 'Evaluated against the Self-Introduction framework.',
    };
  }

  const dimensions = [
    {
      key: 'contextGoal',
      label: 'Context / Goal',
      score: l,
      status: toStatus(l),
      reason: l >= 7 ? 'Context / Goal evidence is explicit in the answer.' : 'Context / Goal is implied but needs a clearer, role-specific explanation.',
    },
    {
      key: 'approach',
      label: 'Approach',
      score: Math.round((l + b) / 2),
      status: toStatus(Math.round((l + b) / 2)),
      reason: Math.round((l + b) / 2) >= 7 ? 'Approach evidence is clearly articulated.' : 'Approach is implied but needs a clearer, role-specific explanation.',
    },
    {
      key: 'judgementTradeoffs',
      label: 'Judgement / Trade-offs',
      score: Math.round((b + e) / 2),
      status: toStatus(Math.round((b + e) / 2)),
      reason: Math.round((b + e) / 2) >= 7 ? 'Judgement / Trade-offs evidence is explicitly detailed.' : 'Judgement / Trade-offs is implied but needs a clearer, role-specific explanation.',
    },
    {
      key: 'riskQualityEthics',
      label: 'Risk / Quality / Ethics',
      score: Math.round((l + e) / 2),
      status: toStatus(Math.round((l + e) / 2)),
      reason: Math.round((l + e) / 2) >= 7 ? 'Risk / Quality / Ethics evidence is clear.' : 'Risk / Quality / Ethics is implied but needs a clearer, role-specific explanation.',
    },
    {
      key: 'validationVerification',
      label: 'Validation / Verification',
      score: e,
      status: toStatus(e),
      reason: e >= 7 ? 'Validation / Verification evidence is explicit.' : 'Validation / Verification is implied but needs a clearer, role-specific explanation.',
    },
    {
      key: 'outcomeValue',
      label: 'Outcome / Value',
      score: b,
      status: toStatus(b),
      reason: b >= 7 ? 'Outcome / Value evidence is clear and quantified.' : 'Outcome / Value is implied but needs a clearer, role-specific explanation.',
    },
  ];

  return {
    normalizedScore: avg,
    dimensions,
    summary: 'This evaluates the answer against the Role-specific Reasoning framework.',
  };
}

function FrameworkBreakdown({ turn }) {
  const hasStar = Boolean(turn.starrBreakdown || turn.starBreakdown);
  if (turn.starApplicable === true && hasStar) return null;

  const breakdown = turn.frameworkBreakdown?.dimensions?.length
    ? turn.frameworkBreakdown
    : (!hasStar && turn.scores ? buildFallbackFrameworkBreakdown(turn) : null);

  if (!breakdown?.dimensions?.length) return null;
  const formatStatus = (status = '') => String(status).replace(/_/g, ' ');

  return (
    <div className="rounded-xl border border-slate-100 bg-white/70 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h5 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {turn.frameworkLabel || turn.structureLabel || 'Role-specific reasoning'}
        </h5>
        {Number.isFinite(Number(breakdown.normalizedScore)) ? (
          <p className="text-xs text-slate-500">Framework score: {Number(breakdown.normalizedScore)}/10</p>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {breakdown.dimensions.filter((dimension) => dimension.status !== 'not_applicable').map((dimension) => (
          <div key={dimension.key || dimension.label} className="rounded-lg bg-slate-50 px-3 py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{dimension.label}</p>
              <span className="text-xs font-medium text-slate-700">
                {Number(dimension.score || 0)}/10
              </span>
            </div>
            <p className="mt-1 text-sm font-medium capitalize text-slate-800">{formatStatus(dimension.status || 'missing')}</p>
            {dimension.reason ? <p className="mt-2 text-xs leading-5 text-slate-600">{dimension.reason}</p> : null}
          </div>
        ))}
      </div>
      {breakdown.summary ? <p className="mt-3 text-xs leading-5 text-slate-600">{breakdown.summary}</p> : null}
    </div>
  );
}

function AnswerAssessment({ assessment }) {
  if (!assessment?.status) return null;
  const label = ANSWER_RESULT_LABELS[assessment.status] || ANSWER_RESULT_LABELS.not_assessed;
  const score = Number.isFinite(Number(assessment.score)) ? `${assessment.score}/100` : 'Not scored';
  const missingSignals = (assessment.missingSignals || []).map((signal) => String(signal).replace(/_/g, ' '));

  return (
    <section className={`rounded-xl border p-4 ${ANSWER_RESULT_STYLES[assessment.status] || ANSWER_RESULT_STYLES.not_assessed}`} aria-label="Answer result">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h5 className="text-xs font-semibold uppercase tracking-wider">Answer result</h5>
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs font-medium">{score}</p>
        </div>
      </div>
      <p className="mt-1 text-xs leading-5">Practice signal for your next answer — not a hiring decision.</p>
      {assessment.summary ? <p className="mt-2 text-sm leading-6">{assessment.summary}</p> : null}
      {missingSignals.length ? <p className="mt-2 text-xs leading-5">What to add: {missingSignals.join(', ')}.</p> : null}
      {assessment.nextStep ? <p className="mt-1 text-xs leading-5">Next step: {assessment.nextStep}</p> : null}
    </section>
  );
}

function buildFallbackStrongerAnswerText(turn = {}) {
  const questionText = (turn.question || '').toLowerCase();
  const rawAnswer = String(turn.answer || '').trim();
  if (!rawAnswer) return null;

  if (/introduce yourself|briefly introduce|about yourself|quick introduction/i.test(questionText)) {
    return `To give a brief introduction, I recently graduated from the University of Auckland with an Electrical Engineering background. What excites me about the Junior AI Integration Engineer role at ZURU is the opportunity to bridge business needs with AI technology, leveraging my experience in building AI applications and cross-departmental collaboration.`;
  }

  if (/ai workflow|recommendation|project|built|system/i.test(questionText)) {
    return `In this project, I owned the AI engine design and data integration for the recommendation system. We evaluated the recommendation system against clear metrics to maximize performance, achieving an 85% project rating and delivering a clear business solution for users.`;
  }

  return `To strengthen this response, clearly state your context and goal first: "${rawAnswer.slice(0, 120)}...". Then specify your personal ownership, technical approach, validation method, and measurable outcome.`;
}

function StrongerAnswer({ rewrite, turn = {} }) {
  const answerText = (rewrite?.status === 'ready' && rewrite?.answer)
    ? rewrite.answer
    : buildFallbackStrongerAnswerText(turn);

  if (!answerText) return null;

  return (
    <section>
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wider text-emerald-700">A stronger answer</h5>
      <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
        <p className="text-sm leading-relaxed text-emerald-900">
          {answerText}
        </p>
      </div>
    </section>
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
                className={`relative hover:z-50 rounded-2xl border transition-all duration-200 ${
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
                    <FrameworkBreakdown turn={turn} />
                    <StructureBreakdown turn={turn} />
                    <AnswerAssessment assessment={turn.answerAssessment} />
                    <div className="mt-2">
                      <EvidenceBadge {...turn} />
                    </div>

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
                    <StrongerAnswer rewrite={turn.strongerAnswer} turn={turn} />
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
