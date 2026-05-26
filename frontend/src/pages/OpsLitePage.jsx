import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/common/Card.jsx';
import { getOpsLiteSummary } from '../api/opsLiteApi.js';

const formatValue = (value, suffix = '') => (
  value === null || value === undefined || value === '' ? '-' : `${value}${suffix}`
);

function MetricGrid({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-gray-100 bg-white/70 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-faint">{item.label}</p>
          <p className="mt-2 text-2xl font-semibold text-primary">{formatValue(item.value, item.suffix)}</p>
        </div>
      ))}
    </div>
  );
}

export default function OpsLitePage() {
  const [summary, setSummary] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    getOpsLiteSummary()
      .then((data) => {
        if (!active) return;
        setSummary(data);
        setStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setStatus('error');
      });
    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading') {
    return <div className="min-h-screen p-8 text-muted">Loading ops summary...</div>;
  }

  if (status === 'error') {
    return <div className="min-h-screen p-8 text-rose-700">Could not load ops-lite summary.</div>;
  }

  const overview = summary?.overview || {};
  const latency = summary?.latency || {};
  const rag = summary?.rag || {};
  const voice = summary?.voice || {};
  const evals = summary?.evals || {};
  const humanCalibration = summary?.humanCalibration || {};

  return (
    <div className="min-h-screen bg-transparent px-4 py-8 text-primary sm:px-8">
      <main className="mx-auto max-w-7xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Ops Lite</h1>
          <p className="mt-2 text-sm text-muted">Compact grounding, latency, eval, and voice-quality monitoring.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
          <CardContent>
            <MetricGrid items={[
              { label: 'Total sessions', value: overview.totalSessions },
              { label: 'Voice metric sessions', value: voice.sessionsWithVoiceMetrics },
              { label: 'Report quality', value: overview.averageReportQualityScore },
              { label: 'Latest eval pass rate', value: overview.latestEvalPassRate },
              { label: 'Model-assisted turns', value: overview.modelAssistedTurnRate },
              { label: 'QA stability', value: evals.stabilityScore },
            ]} />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Latency</CardTitle></CardHeader>
            <CardContent>
              <MetricGrid items={[
                { label: 'STT', value: latency.sttMs, suffix: ' ms' },
                { label: 'Retrieval', value: latency.retrievalMs, suffix: ' ms' },
                { label: 'Planning', value: latency.planningMs, suffix: ' ms' },
                { label: 'LLM first token', value: latency.llmFirstTokenMs, suffix: ' ms' },
                { label: 'TTS first audio', value: latency.ttsFirstAudioMs, suffix: ' ms' },
                { label: 'Total turn', value: latency.totalTurnMs, suffix: ' ms' },
              ]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>RAG & Claims</CardTitle></CardHeader>
            <CardContent>
              <MetricGrid items={[
                { label: 'RAG activation', value: rag.activationRate },
                { label: 'Degraded retrieval', value: rag.degradedRetrievalRate },
                { label: 'Unsupported blocked', value: rag.unsupportedEvidenceBlockedCount },
              ]} />
              <div className="mt-4 flex flex-wrap gap-2">
                {Object.entries(rag.sourceUsage || {}).map(([source, count]) => (
                  <span key={source} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">{source}: {count}</span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader><CardTitle>Voice Delivery</CardTitle></CardHeader>
            <CardContent>
              <MetricGrid items={[
                { label: 'Avg WPM', value: voice.averageWordsPerMinute },
                { label: 'Filler count', value: voice.totalFillerCount },
                { label: 'Long pauses', value: voice.totalLongPauseCount },
                { label: 'Low-confidence sessions', value: voice.lowConfidenceDeliverySessions },
              ]} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Human Calibration Pilot</CardTitle></CardHeader>
            <CardContent>
              <MetricGrid items={[
                { label: 'Sample prompts', value: humanCalibration.sampleSet?.length || 0 },
                { label: 'Completed ratings', value: humanCalibration.completedRatings },
                { label: 'Agreement rate', value: humanCalibration.agreementRate },
                { label: 'Avg score diff', value: humanCalibration.averageScoreDifference },
              ]} />
              <div className="mt-4 space-y-2">
                {(humanCalibration.sampleSet || []).map((item) => (
                  <div key={item.id} className="rounded-lg border border-gray-100 p-3 text-sm text-muted">
                    <span className="font-medium text-primary">{item.label}</span> - {item.dimensions.join(', ')}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
