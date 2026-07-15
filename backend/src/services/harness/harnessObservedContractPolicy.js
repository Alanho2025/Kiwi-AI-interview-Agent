export const HARNESS_GATE_POLICY_VERSION = 'interview_observed_gates_v0';
export const HARNESS_MEMORY_POLICY_VERSION = 'interview_memory_write_v0';

const LOCAL_EXECUTION_MODES = new Set(['shadow', 'observe']);
const GATE_STATUSES = new Set(['pass', 'warn', 'block', 'review', 'degrade']);
const BLOCKING_SCOPES = new Set(['none', 'action', 'task', 'scoring', 'memory_write', 'publication']);
const NEXT_STEPS = new Set(['continue', 'fallback', 'retry', 'wait_for_review', 'reject', 'publish']);

export const normalizeLocalHarnessExecutionMode = (value) => (
  LOCAL_EXECUTION_MODES.has(value) ? value : 'shadow'
);

export const buildObservedGateResult = ({
  gateResultId,
  workflowRunId,
  gateType,
  executionMode = 'shadow',
  evaluatedAt,
  evaluatorRef,
  subjectRef,
  status,
  reasonCodes,
  blockingScope = 'none',
  humanReadableSummary,
  nextStep = { type: 'continue', ref: null },
  humanReviewRef = null,
  enforced = false,
  enforcementSource = 'harness_observe_only',
} = {}) => {
  const normalizedReasons = (reasonCodes || []).filter(Boolean);
  return {
    schemaVersion: 'gate_result_v0',
    gateResultId,
    workflowRunId,
    gateType,
    gatePolicyVersion: HARNESS_GATE_POLICY_VERSION,
    executionMode: normalizeLocalHarnessExecutionMode(executionMode),
    evaluatedAt,
    evaluatorRef,
    subjectRef,
    status,
    reasonCode: normalizedReasons[0] || null,
    reasonCodes: normalizedReasons,
    blockingScope,
    humanReadableSummary,
    nextStep,
    humanReviewRef,
    enforced,
    enforcementSource,
    owner: evaluatorRef,
  };
};

export const buildFailureClassification = ({
  failureId,
  workflowRunId,
  subjectRef = null,
  occurredAt,
  stage,
  category,
  reasonCode,
  handled,
  expected,
  retryable,
  retryAfterMs = null,
  fallbackApplied,
  fallbackRef = null,
  userImpact,
  humanReviewRequired = false,
  redactedErrorRef = null,
  ...metadata
} = {}) => ({
  schemaVersion: 'failure_classification_v0',
  failureId,
  workflowRunId,
  subjectRef,
  occurredAt,
  stage,
  category,
  reasonCode,
  handled: Boolean(handled),
  expected: Boolean(expected),
  retryable: Boolean(retryable),
  retryAfterMs,
  fallbackApplied: Boolean(fallbackApplied),
  fallbackRef,
  userImpact,
  humanReviewRequired: Boolean(humanReviewRequired),
  redactedErrorRef,
  ...metadata,
});

export const validateObservedGateResult = (gate = {}) => {
  const errors = [];
  if (gate.schemaVersion !== 'gate_result_v0') errors.push('schemaVersion must be gate_result_v0');
  if (!gate.gateResultId) errors.push('gateResultId is required');
  if (!gate.workflowRunId) errors.push('workflowRunId is required');
  if (!gate.gateType) errors.push('gateType is required');
  if (!gate.gatePolicyVersion) errors.push('gatePolicyVersion is required');
  if (!LOCAL_EXECUTION_MODES.has(gate.executionMode)) errors.push('executionMode must be shadow or observe');
  if (!GATE_STATUSES.has(gate.status)) errors.push('status is invalid');
  if (!Array.isArray(gate.reasonCodes) || gate.reasonCodes.length === 0) errors.push('reasonCodes must contain at least one item');
  if (!BLOCKING_SCOPES.has(gate.blockingScope)) errors.push('blockingScope is invalid');
  if (!NEXT_STEPS.has(gate.nextStep?.type)) errors.push('nextStep.type is invalid');
  if (gate.status === 'block' && gate.blockingScope === 'none') errors.push('block requires a blockingScope');
  return errors;
};

export const validateFailureClassification = (failure = {}) => {
  const errors = [];
  if (failure.schemaVersion !== 'failure_classification_v0') errors.push('schemaVersion must be failure_classification_v0');
  if (!failure.failureId) errors.push('failureId is required');
  if (!failure.workflowRunId) errors.push('workflowRunId is required');
  if (!failure.occurredAt) errors.push('occurredAt is required');
  if (!failure.stage) errors.push('stage is required');
  if (!failure.category) errors.push('category is required');
  if (!failure.reasonCode) errors.push('reasonCode is required');
  if (!failure.userImpact) errors.push('userImpact is required');
  return errors;
};
