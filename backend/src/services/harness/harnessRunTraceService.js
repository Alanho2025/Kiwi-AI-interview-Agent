import { logger } from '../../utils/logger.js';

const summarizeGate = (gate = {}) => ({
  gateType: gate.gateType || 'unknown',
  status: gate.status || 'unknown',
  reasonCode: gate.reasonCode || null,
});

const summarizeMemoryWrite = (write = {}) => ({
  memoryType: write.memoryType || 'unknown',
  status: write.status || 'unknown',
  canAffectScoring: Boolean(write.canAffectScoring),
});

const summarizeFailure = (failure = {}) => ({
  category: failure.category || 'unknown',
  reasonCode: failure.reasonCode || 'unknown',
  handled: Boolean(failure.handled),
  retryable: Boolean(failure.retryable),
  userImpact: failure.userImpact || 'unknown',
});

const summarizeCorrelation = (correlation = {}) => ({
  decisionRecordCount: Number(correlation.decisionRecordCount || 0),
  trajectoryRecordCount: Number(correlation.trajectoryRecordCount || 0),
  traceEventCount: Number(correlation.traceEventCount || 0),
});

const hasCorrelationCounts = (correlation) => correlation
  && ['decisionRecordCount', 'trajectoryRecordCount', 'traceEventCount']
    .some((field) => Object.hasOwn(correlation, field));

export const buildHarnessRunTrace = ({
  run = {},
  traceStage,
  persistenceStatus,
} = {}) => {
  const action = run.actionContracts?.[0] || {};
  return {
    traceVersion: 'harness_run_trace_v0',
    traceStage,
    persistenceStatus,
    workflowRunId: run.workflowRunId || null,
    sessionId: run.sessionId || null,
    clientTurnId: run.clientTurnId || null,
    taskType: run.taskType || null,
    channel: run.channel || null,
    lifecycleStatus: run.lifecycleStatus || null,
    qualityStatus: run.qualityStatus || null,
    selectedAction: action.selectedAction || null,
    fallbackAction: action.fallbackAction || null,
    selectionSource: action.selectionSource || null,
    gates: (run.gateResults || []).map(summarizeGate),
    memoryWrites: (run.memoryWrites || []).map(summarizeMemoryWrite),
    failures: (run.failures || []).map(summarizeFailure),
    resultRefs: (run.resultRefs || []).filter((ref) => typeof ref === 'string'),
    timeline: (run.timeline || []).map((event) => event.eventType).filter(Boolean),
    correlationStatus: persistenceStatus === 'queued'
      ? 'pending'
      : persistenceStatus === 'persisted' ? 'completed' : 'failed',
    correlation: hasCorrelationCounts(run.correlation)
      ? summarizeCorrelation(run.correlation)
      : null,
    controllerMs: Number(run.latency?.controllerMs || 0),
    startedAt: run.startedAt || null,
    completedAt: run.completedAt || null,
  };
};

export const emitHarnessRunTrace = ({
  run,
  traceStage,
  persistenceStatus,
  logInfo = logger.info,
} = {}) => {
  logInfo('Harness workflow trace', buildHarnessRunTrace({
    run,
    traceStage,
    persistenceStatus,
  }));
};
