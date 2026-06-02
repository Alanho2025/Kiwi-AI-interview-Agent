import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';
import { MessageCircle, AlertCircle, CheckCircle2 } from 'lucide-react';

export function CommunicationAuthenticitySection({ authenticityMetrics }) {
  if (!authenticityMetrics) return null;

  const {
    scriptedRisk,
    conversationalFlowScore,
    overStructuredStarRisk,
    naturalTransitionScore,
    personalVoiceScore,
    reason,
  } = authenticityMetrics;

  const isHighRisk = scriptedRisk === 'high';
  const isMediumRisk = scriptedRisk === 'medium';
  
  let StatusIcon = CheckCircle2;
  let statusColor = 'text-emerald-600 bg-emerald-50 border-emerald-200';
  let titleText = 'Natural & Authentic';
  
  if (isHighRisk) {
    StatusIcon = AlertCircle;
    statusColor = 'text-rose-600 bg-rose-50 border-rose-200';
    titleText = 'Highly Scripted/Robotic';
  } else if (isMediumRisk) {
    StatusIcon = AlertCircle;
    statusColor = 'text-amber-600 bg-amber-50 border-amber-200';
    titleText = 'Slightly Rehearsed';
  }

  return (
    <Card className="border-indigo-100 overflow-hidden mt-6">
      <CardHeader className="bg-indigo-50/50 pb-4 border-b border-indigo-50">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-indigo-600" />
          <CardTitle>Communication Authenticity Insight</CardTitle>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          How natural and conversational your answers felt, beyond just structural correctness.
        </p>
      </CardHeader>
      
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row gap-6">
          
          <div className="md:w-1/3 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-medium mb-3 ${statusColor}`}>
              <StatusIcon className="w-4 h-4" />
              <span>{titleText}</span>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-slate-800">{conversationalFlowScore} <span className="text-lg text-slate-400 font-normal">/ 10</span></div>
              <div className="text-xs text-slate-500 uppercase tracking-wider mt-1 font-medium">Flow Score</div>
            </div>
          </div>
          
          <div className="md:w-2/3 space-y-4">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
              <h4 className="font-semibold text-slate-800 text-sm mb-2">Analysis</h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                {reason}
              </p>
            </div>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                <div className="text-lg font-semibold text-slate-700">{overStructuredStarRisk}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Scripted Risk</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                <div className="text-lg font-semibold text-slate-700">{naturalTransitionScore}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Natural Flow</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 text-center">
                <div className="text-lg font-semibold text-slate-700">{personalVoiceScore}</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-0.5">Personal Voice</div>
              </div>
            </div>
          </div>
          
        </div>
      </CardContent>
    </Card>
  );
}
