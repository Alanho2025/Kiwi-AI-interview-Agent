const EXECUTABLE_CONTROLS_SCHEMA_VERSION = 'harness_execution_controls_v1';
const EXECUTABLE_CONTROLS_POLICY_VERSION = 'harness_executable_controls_observe_v1';
const CAPABILITY_POLICY_VERSION = 'v1';
const REDACTION_POLICY_VERSION = 'harness_redaction_v0';
const DEFAULT_MODEL_TIMEOUT_MS = 30000;

const CAPABILITY_POLICIES = Object.freeze([
  Object.freeze({
    capabilityId: 'retrieval',
    version: CAPABILITY_POLICY_VERSION,
    allowedTaskTypes: ['interview_next_turn', 'generate_report', 'qa_report'],
    inputSchemaRef: 'schema:retrieval_input:current',
    outputSchemaRef: 'schema:retrieval_bundle:current',
    acceptedDataClasses: ['internal', 'private_candidate_data'],
    sideEffectClass: 'none',
    timeoutMs: DEFAULT_MODEL_TIMEOUT_MS,
    retryPolicy: { maxAttempts: 0, retryableReasons: [] },
    fallbackPolicy: { type: 'domain_owned', ref: 'current_retrieval_fallback' },
    redactionPolicyVersion: REDACTION_POLICY_VERSION,
    requiredGateTypes: ['context_eligibility'],
  }),
  Object.freeze({
    capabilityId: 'interviewer',
    version: CAPABILITY_POLICY_VERSION,
    allowedTaskTypes: ['interview_next_turn'],
    inputSchemaRef: 'schema:interviewer_input:current',
    outputSchemaRef: 'schema:interviewer_turn:current',
    acceptedDataClasses: ['internal', 'private_candidate_data'],
    sideEffectClass: 'external_provider',
    timeoutMs: DEFAULT_MODEL_TIMEOUT_MS,
    retryPolicy: { maxAttempts: 0, retryableReasons: [] },
    fallbackPolicy: { type: 'domain_owned', ref: 'current_interview_action_fallback' },
    redactionPolicyVersion: REDACTION_POLICY_VERSION,
    requiredGateTypes: ['action_allowed_candidate', 'question_counting', 'question_novelty'],
  }),
  Object.freeze({
    capabilityId: 'reportGenerator',
    version: CAPABILITY_POLICY_VERSION,
    allowedTaskTypes: ['generate_report'],
    inputSchemaRef: 'schema:report_generator_input:current',
    outputSchemaRef: 'schema:session_report_v7',
    acceptedDataClasses: ['internal', 'private_candidate_data'],
    sideEffectClass: 'external_provider',
    timeoutMs: DEFAULT_MODEL_TIMEOUT_MS,
    retryPolicy: { maxAttempts: 0, retryableReasons: [] },
    fallbackPolicy: { type: 'domain_owned', ref: 'current_report_generation_fallback' },
    redactionPolicyVersion: REDACTION_POLICY_VERSION,
    requiredGateTypes: ['report_publication_allowed'],
  }),
  Object.freeze({
    capabilityId: 'reportQa',
    version: CAPABILITY_POLICY_VERSION,
    allowedTaskTypes: ['generate_report', 'qa_report'],
    inputSchemaRef: 'schema:report_qa_input:current',
    outputSchemaRef: 'schema:report_qa_result:current',
    acceptedDataClasses: ['internal', 'private_candidate_data'],
    sideEffectClass: 'external_provider',
    timeoutMs: DEFAULT_MODEL_TIMEOUT_MS,
    retryPolicy: { maxAttempts: 0, retryableReasons: [] },
    fallbackPolicy: { type: 'domain_owned', ref: 'current_report_qa_fallback' },
    redactionPolicyVersion: REDACTION_POLICY_VERSION,
    requiredGateTypes: ['report_publication_allowed'],
  }),
  Object.freeze({
    capabilityId: 'interviewEvaluator',
    version: CAPABILITY_POLICY_VERSION,
    allowedTaskTypes: ['interview_next_turn'],
    inputSchemaRef: 'schema:interview_evaluator_input:current',
    outputSchemaRef: 'schema:interview_evaluation:current',
    acceptedDataClasses: ['internal', 'private_candidate_data'],
    sideEffectClass: 'external_provider',
    timeoutMs: DEFAULT_MODEL_TIMEOUT_MS,
    retryPolicy: { maxAttempts: 0, retryableReasons: [] },
    fallbackPolicy: { type: 'domain_owned', ref: 'current_interview_evaluation_fallback' },
    redactionPolicyVersion: REDACTION_POLICY_VERSION,
    requiredGateTypes: ['transcript_eligibility'],
  }),
]);

const CAPABILITY_IDS_BY_TASK = Object.freeze({
  interview_next_turn: ['retrieval', 'interviewer', 'interviewEvaluator'],
  generate_report: ['retrieval', 'reportGenerator', 'reportQa'],
  qa_report: ['retrieval', 'reportQa'],
});

const TASK_RESULT_SCHEMA_REFS = Object.freeze({
  interview_next_turn: 'schema:interview_next_turn_result:current',
  generate_report: 'schema:generate_report_result:current',
  qa_report: 'schema:qa_report_result:current',
});

const clone = (value) => JSON.parse(JSON.stringify(value));

const toNonNegativeMeasurement = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
};

const sumMeasuredField = (events, field) => {
  const values = events.map((event) => toNonNegativeMeasurement(event[field]));
  if (values.some((value) => value === null)) return null;
  return values.reduce((total, value) => total + value, 0);
};

const capabilityRef = (policy) => `capability:${policy.capabilityId}:${policy.version}`;

const getCapabilityPolicy = (capabilityId) => (
  CAPABILITY_POLICIES.find((policy) => policy.capabilityId === capabilityId) || null
);

const buildCheck = ({ checkType, status, reasonCode }) => ({
  checkType,
  status,
  reasonCode,
});

const buildTaskContract = ({ taskType, capabilityPolicies }) => ({
  schemaVersion: 'task_contract_v1',
  contractVersion: 'v1',
  allowedCapabilityRefs: capabilityPolicies.map(capabilityRef),
  budgetPolicyRef: `budget_policy:${taskType}:observe_v1`,
  cancellationPolicyRef: `cancellation_policy:${taskType}:observe_v1`,
  resultSchemaRef: TASK_RESULT_SCHEMA_REFS[taskType] || null,
  successCriteria: ['domain_result_recorded', 'postflight_result_status_recorded'],
  stopConditions: ['controller_error', 'session_or_access_invalid', 'budget_exceeded'],
});

const buildBudgetLedger = ({ taskType, evaluatedAt }) => ({
  schemaVersion: 'budget_ledger_v1',
  policyRef: `budget_policy:${taskType}:observe_v1`,
  requestedCeiling: {
    enforcement: 'observe',
    maxModelCalls: null,
    maxInputTokens: null,
    maxOutputTokens: null,
    maxEstimatedCost: null,
    currency: 'USD',
    deadlineMs: null,
    overBudgetAction: 'review',
  },
  actualModelCalls: null,
  actualInputTokens: null,
  actualOutputTokens: null,
  actualEstimatedCost: null,
  elapsedMs: 0,
  budgetStatus: 'unavailable',
  stopReason: 'usage_not_correlated',
  updatedAt: evaluatedAt,
});

const resolveResultState = ({
  lifecycleStatus,
  qualityStatus,
  publicationStatus,
  controllerError,
}) => {
  if (lifecycleStatus === 'waiting' || lifecycleStatus === 'running') {
    return {
      validationStatus: 'partial',
      stopReason: 'workflow_waiting',
      nextStep: { type: 'wait_for_review', ref: null },
    };
  }
  if (controllerError || lifecycleStatus === 'failed') {
    return {
      validationStatus: 'failed',
      stopReason: 'controller_execution_failed',
      nextStep: { type: 'retry', ref: null },
    };
  }
  if (publicationStatus === 'needs_review' || publicationStatus === 'rejected') {
    return {
      validationStatus: 'partial',
      stopReason: 'publication_review_required',
      nextStep: { type: 'wait_for_review', ref: null },
    };
  }
  if (qualityStatus === 'invalid' || qualityStatus === 'blocked') {
    return {
      validationStatus: 'partial',
      stopReason: 'postflight_review_required',
      nextStep: { type: 'retry', ref: null },
    };
  }
  return {
    validationStatus: 'valid',
    stopReason: null,
    nextStep: { type: 'continue', ref: null },
  };
};

export const listHarnessCapabilityPolicies = () => clone(CAPABILITY_POLICIES);

export const createObservedCapabilityRegistry = ({
  workflowRunId = null,
  registry = {},
  now = () => new Date(),
  withUsageContext = (_context, execute) => execute(),
} = {}) => {
  const events = [];
  const usageEvents = [];
  const recordUsage = (usage = {}) => {
    usageEvents.push({
      provider: String(usage.provider || 'unknown').slice(0, 40),
      model: String(usage.model || 'unknown').slice(0, 80),
      capabilityId: usage.capabilityId || null,
      promptTokens: toNonNegativeMeasurement(usage.promptTokens),
      completionTokens: toNonNegativeMeasurement(usage.completionTokens),
      estimatedCost: toNonNegativeMeasurement(usage.estimatedCost),
    });
  };
  const observedRegistry = Object.fromEntries(
    Object.entries(registry).map(([capabilityId, capability]) => {
      if (typeof capability !== 'function') return [capabilityId, capability];
      return [capabilityId, async (...args) => {
        const startedAt = now();
        events.push({
          eventType: 'capability_call_started',
          capabilityId,
          capabilityRef: getCapabilityPolicy(capabilityId)
            ? capabilityRef(getCapabilityPolicy(capabilityId))
            : null,
          status: 'started',
          at: startedAt.toISOString(),
        });
        try {
          const result = await withUsageContext({
            workflowRunId,
            harnessCapabilityId: capabilityId,
            harnessUsageCollector: (usage) => recordUsage({
              ...usage,
              capabilityId,
            }),
          }, () => capability(...args));
          const completedAt = now();
          events.push({
            eventType: 'capability_call_completed',
            capabilityId,
            capabilityRef: getCapabilityPolicy(capabilityId)
              ? capabilityRef(getCapabilityPolicy(capabilityId))
              : null,
            status: 'completed',
            at: completedAt.toISOString(),
            durationMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
          });
          return result;
        } catch (error) {
          const failedAt = now();
          events.push({
            eventType: 'capability_call_failed',
            capabilityId,
            capabilityRef: getCapabilityPolicy(capabilityId)
              ? capabilityRef(getCapabilityPolicy(capabilityId))
              : null,
            status: 'failed',
            at: failedAt.toISOString(),
            durationMs: Math.max(0, failedAt.getTime() - startedAt.getTime()),
            errorName: error?.name || 'Error',
          });
          throw error;
        }
      }];
    }),
  );

  return {
    registry: observedRegistry,
    events,
    usageEvents,
    recordUsage,
  };
};

export const buildObservedWriteGateDecisions = ({
  workflowRunId,
  taskType,
  ownerUserId,
  sessionId,
  publicationStatus = 'not_applicable',
  memoryWrites = [],
  evaluatedAt = new Date().toISOString(),
} = {}) => {
  const decisions = [];
  if (['generate_report', 'qa_report'].includes(taskType)) {
    const publishable = ['ready', 'ready_after_repair', 'published'].includes(publicationStatus);
    decisions.push({
      schemaVersion: 'write_gate_decision_v1',
      writeGateDecisionId: `write_gate:${workflowRunId}:report`,
      decisionType: 'report_write',
      proposalRef: `report_proposal:${workflowRunId}`,
      targetRef: `session_report:${sessionId}`,
      ownerScope: { ownerUserId, sessionId },
      policyVersion: 'report_publication_v0',
      evidenceRefs: [`gate:${workflowRunId}:report_publication_allowed`],
      idempotencyKey: `report_write:${workflowRunId}`,
      decision: publishable ? 'accept' : 'review',
      gateResultRef: `gate:${workflowRunId}:report_publication_allowed`,
      enforced: false,
      sideEffectStatus: 'completed_before_observe_gate',
      evaluatedAt,
    });
  }

  memoryWrites.forEach((write) => {
    const isSessionLocal = write.scope === 'session';
    decisions.push({
      schemaVersion: 'write_gate_decision_v1',
      writeGateDecisionId: `write_gate:${workflowRunId}:${write.memoryWriteId}`,
      decisionType: 'memory_write',
      proposalRef: write.memoryWriteId,
      targetRef: write.memoryWriteId,
      ownerScope: { ownerUserId, sessionId },
      policyVersion: write.policyVersion || 'memory_policy_unavailable',
      evidenceRefs: Array.isArray(write.sourceEvidenceRefs)
        ? [...write.sourceEvidenceRefs]
        : [],
      idempotencyKey: `memory_write:${write.memoryWriteId}`,
      decision: isSessionLocal ? 'accept' : 'defer',
      gateResultRef: write.gateResultRef || null,
      enforced: false,
      sideEffectStatus: write.status || 'unknown',
      evaluatedAt,
    });
  });

  return decisions;
};

export const buildHarnessExecutionControlContext = ({
  workflowRunId,
  taskType,
  session = {},
  executionMode = 'shadow',
  requestedCapabilityIds = CAPABILITY_IDS_BY_TASK[taskType] || [],
  availableCapabilityIds = CAPABILITY_POLICIES.map((policy) => policy.capabilityId),
  evaluatedAt = new Date().toISOString(),
} = {}) => {
  const taskKnown = Object.hasOwn(CAPABILITY_IDS_BY_TASK, taskType);
  const capabilityPolicies = requestedCapabilityIds
    .map(getCapabilityPolicy)
    .filter(Boolean);
  const missingCapability = capabilityPolicies.length !== requestedCapabilityIds.length;
  const disallowedCapability = capabilityPolicies.some(
    (policy) => !policy.allowedTaskTypes.includes(taskType),
  );
  const unavailableCapability = requestedCapabilityIds.some(
    (capabilityId) => !availableCapabilityIds.includes(capabilityId),
  );
  const ownerScopeAvailable = Boolean(session.id && session.userId);
  const capabilityScopePassed = !missingCapability
    && !disallowedCapability
    && !unavailableCapability;
  const checks = [
    buildCheck({
      checkType: 'task_contract',
      status: taskKnown ? 'pass' : 'block',
      reasonCode: taskKnown ? 'task_contract_available' : 'task_contract_missing',
    }),
    buildCheck({
      checkType: 'owner_scope',
      status: ownerScopeAvailable ? 'pass' : 'block',
      reasonCode: ownerScopeAvailable ? 'owner_scope_available' : 'owner_scope_missing',
    }),
    buildCheck({
      checkType: 'capability_scope',
      status: capabilityScopePassed ? 'pass' : 'block',
      reasonCode: missingCapability
        ? 'capability_policy_missing'
        : disallowedCapability
          ? 'capability_not_allowed_for_task'
          : unavailableCapability ? 'capability_not_registered' : 'capability_scope_allowed',
    }),
    buildCheck({
      checkType: 'budget_policy',
      status: 'review',
      reasonCode: 'numeric_budget_not_frozen',
    }),
  ];
  const blockingChecks = checks.filter((check) => check.status === 'block');
  const reasonCodes = blockingChecks.length
    ? [...new Set(blockingChecks.map((check) => check.reasonCode))]
    : ['numeric_budget_not_frozen'];

  return {
    schemaVersion: EXECUTABLE_CONTROLS_SCHEMA_VERSION,
    policyVersion: EXECUTABLE_CONTROLS_POLICY_VERSION,
    workflowRunId,
    taskType,
    executionMode,
    taskContract: buildTaskContract({ taskType, capabilityPolicies }),
    capabilityPolicies: clone(capabilityPolicies),
    registryCoverage: {
      registeredCapabilityIds: [...availableCapabilityIds],
      policyCapabilityIds: CAPABILITY_POLICIES.map((policy) => policy.capabilityId),
      requestedCapabilityIds: [...requestedCapabilityIds],
      status: unavailableCapability || missingCapability ? 'incomplete' : 'covered',
    },
    preflight: {
      evaluatedAt,
      executionMode,
      status: blockingChecks.length ? 'block' : 'review',
      controllerAction: 'continue_observe',
      wouldBlockInEnforce: blockingChecks.length > 0,
      reasonCodes,
      checks,
    },
    budgetLedger: buildBudgetLedger({ taskType, evaluatedAt }),
    postflight: null,
    resultEnvelope: null,
    events: [{
      eventType: 'task_preflight_evaluated',
      at: evaluatedAt,
      ref: `preflight:${workflowRunId}`,
    }],
  };
};

export const completeHarnessExecutionControls = ({
  context,
  completedAt = new Date().toISOString(),
  lifecycleStatus,
  qualityStatus,
  publicationStatus,
  domainResultRef = null,
  controllerError = null,
  capabilityEvents = [],
  usageEvents = [],
  writeGateDecisions = [],
} = {}) => {
  const resultState = resolveResultState({
    lifecycleStatus,
    qualityStatus,
    publicationStatus,
    controllerError,
  });
  const elapsedMs = Math.max(
    0,
    new Date(completedAt).getTime() - new Date(context.preflight.evaluatedAt).getTime(),
  );
  const hasCorrelatedUsage = usageEvents.length > 0;
  const actualInputTokens = hasCorrelatedUsage
    ? sumMeasuredField(usageEvents, 'promptTokens')
    : null;
  const actualOutputTokens = hasCorrelatedUsage
    ? sumMeasuredField(usageEvents, 'completionTokens')
    : null;
  const measuredCost = hasCorrelatedUsage
    ? sumMeasuredField(usageEvents, 'estimatedCost')
    : null;
  const actualEstimatedCost = measuredCost === null ? null : Number(measuredCost.toFixed(8));
  const usageUnknowns = [
    ...(!hasCorrelatedUsage ? ['actual_usage'] : []),
    ...(hasCorrelatedUsage && actualInputTokens === null ? ['actual_input_tokens'] : []),
    ...(hasCorrelatedUsage && actualOutputTokens === null ? ['actual_output_tokens'] : []),
    ...(hasCorrelatedUsage && actualEstimatedCost === null ? ['actual_estimated_cost'] : []),
  ];
  const budgetLedger = hasCorrelatedUsage
    ? {
        ...context.budgetLedger,
        actualModelCalls: usageEvents.length,
        actualInputTokens,
        actualOutputTokens,
        actualEstimatedCost,
        elapsedMs,
        budgetStatus: 'unavailable',
        stopReason: 'numeric_budget_not_frozen',
        updatedAt: completedAt,
      }
    : {
        ...context.budgetLedger,
        elapsedMs,
        updatedAt: completedAt,
      };
  const postflight = {
    evaluatedAt: completedAt,
    status: resultState.validationStatus === 'valid' ? 'pass' : 'review',
    reasonCodes: [resultState.stopReason || 'result_contract_valid'],
    controllerAction: 'preserve_domain_result',
  };
  const resultEnvelope = {
    schemaVersion: 'result_envelope_v1',
    domainResultRef,
    lifecycleStatus,
    qualityStatus,
    publicationStatus,
    validationStatus: resultState.validationStatus,
    stopReason: resultState.stopReason,
    warnings: context.preflight.status === 'review' ? ['numeric_budget_not_frozen'] : [],
    unknowns: usageUnknowns,
    nextStep: resultState.nextStep,
  };

  return {
    ...context,
    capabilityCalls: clone(capabilityEvents),
    writeGateDecisions: clone(writeGateDecisions),
    budgetLedger,
    postflight,
    resultEnvelope,
    events: [
      ...context.events,
      ...clone(capabilityEvents),
      ...writeGateDecisions.map((decision) => ({
        eventType: 'write_gate_decided',
        at: decision.evaluatedAt,
        ref: decision.writeGateDecisionId,
      })),
      {
        eventType: 'budget_updated',
        at: completedAt,
        ref: `budget_ledger:${context.workflowRunId}`,
      },
      {
        eventType: 'result_postflight_evaluated',
        at: completedAt,
        ref: `result_envelope:${context.workflowRunId}`,
      },
    ],
  };
};

export const validateHarnessExecutionControls = (controls = {}) => {
  const errors = [];
  if (controls.schemaVersion !== EXECUTABLE_CONTROLS_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${EXECUTABLE_CONTROLS_SCHEMA_VERSION}`);
  }
  if (!controls.workflowRunId) errors.push('workflowRunId is required');
  if (!controls.taskType) errors.push('taskType is required');
  if (!controls.taskContract?.allowedCapabilityRefs) {
    errors.push('taskContract.allowedCapabilityRefs is required');
  }
  if (!Array.isArray(controls.capabilityPolicies)) {
    errors.push('capabilityPolicies must be an array');
  }
  if (!controls.preflight?.evaluatedAt) errors.push('preflight.evaluatedAt is required');
  if (!controls.budgetLedger?.policyRef) errors.push('budgetLedger.policyRef is required');
  if (!controls.postflight?.evaluatedAt) errors.push('postflight.evaluatedAt is required');
  if (!controls.resultEnvelope?.validationStatus) {
    errors.push('resultEnvelope.validationStatus is required');
  }
  if (!Array.isArray(controls.writeGateDecisions)) {
    errors.push('writeGateDecisions must be an array');
  }
  return { valid: errors.length === 0, errors };
};
