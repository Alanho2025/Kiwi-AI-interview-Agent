export const LATENCY_TARGETS_MS = {
  vadSilenceMs: 2600,
  sttFinalisationMs: 1200,
  backendReasoningMs: 3000,
  submitToFirstAudioChunkMs: 4500,
  vadToPlaybackMs: 6500,
  firstAudioChunkToPlayMs: 500,
};

const percentile = (values, p) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
};

const stats = (values = []) => {
  const clean = values.filter((value) => Number.isFinite(value));
  if (!clean.length) return { avg: 0, median: 0, max: 0, min: 0, p95: 0, n: 0 };
  return {
    avg: Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length),
    median: percentile(clean, 50),
    max: Math.max(...clean),
    min: Math.min(...clean),
    p95: percentile(clean, 95),
    n: clean.length,
  };
};

const getStep = (trace, stepName) => trace?.backendLatency?.steps?.find((step) => step.step === stepName || step.name === stepName)
  || trace?.backend?.steps?.find((step) => step.step === stepName || step.name === stepName)
  || trace?.steps?.find((step) => step.step === stepName || step.name === stepName);

const getStepDuration = (trace, stepName) => getStep(trace, stepName)?.durationMs;
const getMarkMs = (trace, stepName) => getStep(trace, stepName)?.msFromStart;

export function buildVoiceLatencySummary({ sessionId, traces = [], targets = LATENCY_TARGETS_MS } = {}) {
  const steps = {
    vadSilenceMs: stats(traces.map((trace) => trace?.vad?.silenceDurationMs ?? trace?.vadSilenceMs ?? trace?.derived?.pauseCandidateToConfirmedMs)),
    sttFinalisationMs: stats(traces.map((trace) => trace?.derived?.sttFinalisationMs ?? trace?.sttFinalisationMs ?? trace?.asrFinaliseMs)),
    backendReasoningMs: stats(traces.map((trace) => getStepDuration(trace, 'adaptive_next_question') ?? trace?.backend?.adaptiveNextQuestionMs ?? trace?.adaptiveMs)),
    firstSentenceReadyMs: stats(traces.map((trace) => getMarkMs(trace, 'first_sentence_ready') ?? trace?.backend?.firstSentenceReadyMs)),
    firstAudioSentMs: stats(traces.map((trace) => getMarkMs(trace, 'first_audio_sent') ?? trace?.backend?.firstAudioSentMs)),
    submitToFirstAudioChunkMs: stats(traces.map((trace) => trace?.derived?.submitToFirstAudioChunkMs ?? trace?.submitToFirstAudioChunkMs)),
    firstAudioChunkToPlayMs: stats(traces.map((trace) => trace?.derived?.firstAudioChunkToPlayMs ?? trace?.firstAudioChunkToPlayMs)),
    vadToPlaybackMs: stats(traces.map((trace) => trace?.derived?.vadToPlaybackMs ?? trace?.derived?.stopToNextAudioMs ?? trace?.stopToNextAudioMs)),
  };

  const warnings = Object.entries(steps)
    .filter(([key, value]) => targets[key] && value.max > targets[key])
    .map(([key, value]) => `${key} exceeded ${targets[key]}ms, max ${value.max}ms`);

  const slowestStep = Object.entries(steps).reduce((slowest, [key, value]) => (
    value.avg > (steps[slowest]?.avg || 0) ? key : slowest
  ), 'vadToPlaybackMs');

  return {
    sessionId,
    turns: traces.length,
    averageVadToPlaybackMs: steps.vadToPlaybackMs.avg,
    p95VadToPlaybackMs: steps.vadToPlaybackMs.p95,
    averageSubmitToFirstAudioChunkMs: steps.submitToFirstAudioChunkMs.avg,
    p95SubmitToFirstAudioChunkMs: steps.submitToFirstAudioChunkMs.p95,
    slowestStep,
    steps,
    warnings,
  };
}
