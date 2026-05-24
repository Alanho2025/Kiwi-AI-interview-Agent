/**
 * File responsibility: Compact commercial execution cost section for reports.
 */

import React from 'react';
import { ChevronDown, CircleDollarSign, Clock, Cpu, Mic } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../common/Card.jsx';
import { formatUsageCost } from '../../utils/formatters.js';

const formatTokens = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  if (numeric >= 1_000_000) return `${(numeric / 1_000_000).toFixed(2)}M`;
  if (numeric >= 1_000) return `${(numeric / 1_000).toFixed(1)}K`;
  return String(numeric);
};

const formatSpeech = (seconds) => {
  const numeric = Number(seconds);
  if (!Number.isFinite(numeric) || numeric <= 0) return '0 min';
  return `${(numeric / 60).toFixed(numeric < 60 ? 1 : 0)} min`;
};

const SummaryMetric = ({ icon: Icon, label, value }) => (
  <div className="rounded-xl border border-theme bg-chip p-3">
    <div className="flex items-center gap-2 text-faint">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</span>
    </div>
    <div className="mt-2 text-sm font-semibold text-primary">{value}</div>
  </div>
);

export function CommercialStressTestSection({ commercialStressTest }) {
  if (!commercialStressTest) return null;

  const humanMinutes = commercialStressTest.estimatedHumanMinutesReplaced || {};
  const stageBreakdown = commercialStressTest.stageBreakdown || [];
  const currency = commercialStressTest.currency || 'NZD';

  return (
    <Card>
      <CardHeader className="items-start">
        <div>
          <CardTitle>Commercial Stress Test</CardTitle>
          <p className="mt-1 text-sm text-faint">Estimated provider cost in NZD compared with equivalent manual review and coaching time.</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryMetric icon={CircleDollarSign} label="Execution cost" value={formatUsageCost(commercialStressTest.totalExecutionCost, currency)} />
          <SummaryMetric icon={Cpu} label="LLM tokens" value={formatTokens(commercialStressTest.totalLlmTokens)} />
          <SummaryMetric icon={Mic} label="Speech usage" value={formatSpeech(commercialStressTest.speechAudioSeconds)} />
          <SummaryMetric icon={Clock} label="Human time" value={`${humanMinutes.min || 0}-${humanMinutes.max || 0} min`} />
        </div>

        <p className="text-sm leading-6 text-muted">{commercialStressTest.conclusion}</p>

        {stageBreakdown.length ? (
          <details className="group rounded-xl border border-theme">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-semibold text-primary">View stage breakdown</span>
              <ChevronDown className="h-4 w-4 text-faint transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="border-t border-theme p-4">
              <div className="space-y-2">
                {stageBreakdown.map((stage) => (
                  <div key={stage.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-lg bg-chip px-3 py-2 text-sm sm:grid-cols-[1fr_1fr_auto]">
                    <span className="font-medium text-primary">{stage.label}</span>
                    <span className="hidden text-muted sm:block">{(stage.providers || []).join(' + ') || '-'}</span>
                    <span className="font-mono text-muted">{formatUsageCost(stage.estimatedCost, stage.currency || currency)}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-faint">{commercialStressTest.assumptions}</p>
            </div>
          </details>
        ) : (
          <p className="text-xs leading-5 text-faint">{commercialStressTest.assumptions}</p>
        )}
      </CardContent>
    </Card>
  );
}
