const nowMs = () => Number(process.hrtime.bigint()) / 1_000_000;

const sanitizeValue = (value) => {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'boolean' || typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map(sanitizeValue).filter((item) => item !== undefined);
  if (typeof value === 'object') return sanitizeMetadata(value);
  return undefined;
};

const sanitizeMetadata = (metadata = {}) => Object.entries(metadata || {}).reduce((acc, [key, value]) => {
  const sanitized = sanitizeValue(value);
  if (sanitized !== undefined) acc[key] = sanitized;
  return acc;
}, {});

const cloneSteps = (steps = []) => steps.map((step) => ({ ...step }));

const buildStepSummary = (steps = []) => steps.reduce((summary, step) => {
  const current = summary[step.step] || {
    count: 0,
    okCount: 0,
    failedCount: 0,
    totalDurationMs: 0,
    maxDurationMs: 0,
    latestMsFromStart: 0,
  };
  const durationMs = Number.isFinite(Number(step.durationMs)) ? Number(step.durationMs) : 0;
  const next = {
    count: current.count + 1,
    okCount: current.okCount + (step.ok === false ? 0 : 1),
    failedCount: current.failedCount + (step.ok === false ? 1 : 0),
    totalDurationMs: current.totalDurationMs + durationMs,
    maxDurationMs: Math.max(current.maxDurationMs, durationMs),
    latestMsFromStart: Math.max(current.latestMsFromStart, Number(step.msFromStart || 0)),
  };
  return {
    ...summary,
    [step.step]: next,
  };
}, {});

const buildSlowestSteps = (steps = [], limit = 8) => steps
  .filter((step) => Number.isFinite(Number(step.durationMs)))
  .map((step) => ({
    step: step.step,
    durationMs: Number(step.durationMs),
    msFromStart: Number(step.msFromStart || 0),
    ok: step.ok !== false,
  }))
  .sort((left, right) => right.durationMs - left.durationMs)
  .slice(0, limit);

export const createMatchPerformanceTrace = (metadata = {}, { onStep = null } = {}) => {
  const startedAtMs = nowMs();
  const startedAt = new Date().toISOString();
  const steps = [];
  const baseMetadata = sanitizeMetadata(metadata);

  const notifyStep = (event) => {
    if (typeof onStep !== 'function') return;
    try {
      onStep(event);
    } catch {
      // Progress reporting is observational and must never change Match authority.
    }
  };

  const pushStep = (step, startedStepAtMs, ok, extra = {}, { includeErrorInObserver = true } = {}) => {
    const currentMs = nowMs();
    const record = {
      step,
      durationMs: Math.max(0, Math.round(currentMs - startedStepAtMs)),
      msFromStart: Math.max(0, Math.round(currentMs - startedAtMs)),
      ok,
      ...sanitizeMetadata(extra),
    };
    steps.push(record);
    const observerMetadata = sanitizeMetadata(extra);
    if (!includeErrorInObserver) {
      delete observerMetadata.error;
    }
    notifyStep({
      phase: 'completed',
      step,
      ok,
      durationMs: record.durationMs,
      msFromStart: record.msFromStart,
      metadata: observerMetadata,
    });
    return record;
  };

  const mark = (step, extra = {}) => {
    const currentMs = nowMs();
    const record = {
      step,
      msFromStart: Math.max(0, Math.round(currentMs - startedAtMs)),
      ok: true,
      ...sanitizeMetadata(extra),
    };
    steps.push(record);
    notifyStep({
      phase: 'completed',
      step,
      ok: true,
      msFromStart: record.msFromStart,
      metadata: sanitizeMetadata(extra),
    });
    return record;
  };

  const measure = async (step, fn, extra = {}) => {
    const startedStepAtMs = nowMs();
    notifyStep({
      phase: 'started',
      step,
      metadata: sanitizeMetadata(extra),
    });
    try {
      const result = await fn();
      pushStep(step, startedStepAtMs, true, extra);
      return result;
    } catch (error) {
      pushStep(step, startedStepAtMs, false, {
        ...extra,
        error: error?.message || String(error),
      }, { includeErrorInObserver: false });
      throw error;
    }
  };

  const toJSON = (extra = {}) => {
    const traceSteps = cloneSteps(steps);
    return {
      schemaVersion: 'match_performance_trace_v1',
      startedAt,
      totalMs: Math.max(0, Math.round(nowMs() - startedAtMs)),
      ...baseMetadata,
      ...sanitizeMetadata(extra),
      steps: traceSteps,
      stepSummary: buildStepSummary(traceSteps),
      slowestSteps: buildSlowestSteps(traceSteps),
    };
  };

  return { mark, measure, toJSON };
};

export const measureMatchStep = async (trace, step, fn, extra = {}) => {
  if (!trace?.measure) return fn();
  return trace.measure(step, fn, extra);
};

export const markMatchStep = (trace, step, extra = {}) => {
  if (!trace?.mark) return null;
  return trace.mark(step, extra);
};
