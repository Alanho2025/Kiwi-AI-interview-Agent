export const LATENCY_TARGETS_MS = {
  vadSilenceMs: 1600,
  asrFinaliseMs: 1200,
  adaptiveMs: 3000,
  ttsMs: 1500,
  stopToNextAudioMs: 5500,
};

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const stats = (values = []) => {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return { avg: 0, max: 0, p95: 0 };
  return {
    avg: Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length),
    max: Math.max(...clean),
    p95: percentile(clean, 95),
  };
};

export function buildVoiceLatencySummary({ sessionId, traces = [], targets = LATENCY_TARGETS_MS } = {}) {
  const stopToNextAudio = traces.map((trace) => trace?.derived?.stopToNextAudioMs ?? trace?.stopToNextAudioMs).filter(Number.isFinite);
  const steps = {
    vadSilenceMs: stats(traces.map((trace) => trace?.vad?.silenceDurationMs ?? trace?.vadSilenceMs)),
    asrFinaliseMs: stats(traces.map((trace) => trace?.asrFinaliseMs)),
    adaptiveMs: stats(traces.map((trace) => trace?.backend?.adaptiveNextQuestionMs ?? trace?.adaptiveMs)),
    ttsMs: stats(traces.map((trace) => trace?.backend?.ttsMs ?? trace?.ttsMs)),
    stopToNextAudioMs: stats(stopToNextAudio),
  };

  const warnings = Object.entries(steps)
    .filter(([key, value]) => targets[key] && value.max > targets[key])
    .map(([key, value]) => `${key} exceeded ${targets[key]}ms, max ${value.max}ms`);

  const slowestStep = Object.entries(steps).reduce((slowest, [key, value]) => (
    value.avg > (steps[slowest]?.avg || 0) ? key : slowest
  ), 'vadSilenceMs');

  return {
    sessionId,
    turns: traces.length,
    averageStopToNextAudioMs: steps.stopToNextAudioMs.avg,
    p95StopToNextAudioMs: steps.stopToNextAudioMs.p95,
    slowestStep,
    steps,
    warnings,
  };
}
