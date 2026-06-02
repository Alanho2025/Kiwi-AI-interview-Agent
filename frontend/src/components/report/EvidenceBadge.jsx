import React, { useState } from 'react';
import { Info, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';

const EVIDENCE_LABELS = {
  supported_by_answer: 'Supported by interview answer',
  supported_by_cv: 'Supported by CV',
  supported_by_jd: 'Supported by job description',
  supported_by_nz_guide: 'Supported by NZ workplace guide',
  needs_user_confirmation: 'Needs your confirmation',
};

export function EvidenceBadge({
  evidenceLabel,
  confidenceLevel,
  feedbackStatus,
  evidenceReason,
  evidenceSnippets = [],
  needsUserConfirmation,
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!evidenceLabel) return null;

  const labelText = EVIDENCE_LABELS[evidenceLabel] || 'Evidence collected';
  
  let badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
  let Icon = Info;

  if (confidenceLevel === 'high' || feedbackStatus === 'confirmed_feedback') {
    badgeColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
    Icon = CheckCircle2;
  } else if (needsUserConfirmation || feedbackStatus === 'needs_confirmation') {
    badgeColor = 'bg-amber-50 text-amber-700 border-amber-200';
    Icon = AlertTriangle;
  } else if (confidenceLevel === 'low' || feedbackStatus === 'refused_claim') {
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
    Icon = ShieldAlert;
  }

  return (
    <div className="relative inline-flex items-center"
         onMouseEnter={() => setShowTooltip(true)}
         onMouseLeave={() => setShowTooltip(false)}>
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium cursor-help transition-colors ${badgeColor}`}>
        <Icon className="w-3.5 h-3.5" />
        <span>{labelText}</span>
        {confidenceLevel && confidenceLevel !== 'high' && (
          <span className="opacity-75">· {confidenceLevel} conf.</span>
        )}
      </div>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-50 w-72 p-3 mt-2 text-sm bg-white border border-slate-200 rounded-lg shadow-xl top-full left-0 -translate-x-1/4">
          <div className="font-semibold text-slate-800 mb-1">Evidence Breakdown</div>
          <p className="text-slate-600 text-xs mb-2 leading-relaxed">{evidenceReason}</p>
          
          {evidenceSnippets && evidenceSnippets.length > 0 && (
            <div className="space-y-2 mt-3 pt-2 border-t border-slate-100">
              {evidenceSnippets.map((snippet, idx) => (
                <div key={idx} className="text-xs">
                  <div className="font-medium text-slate-700 uppercase tracking-wider text-[10px] mb-0.5">
                    Source: {snippet.sourceType.replace('_', ' ')}
                  </div>
                  <div className="bg-slate-50 p-1.5 rounded border border-slate-100 text-slate-600 italic">
                    "{snippet.text}"
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
