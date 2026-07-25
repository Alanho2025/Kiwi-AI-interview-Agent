import crypto from 'crypto';

import { buildRetentionExpiry } from '../retention/retentionPolicy.js';
import { logger } from '../../utils/logger.js';
import {
  buildHarnessIdempotencyKey,
  HARNESS_REDACTION_POLICY_VERSION,
  validateHarnessWorkflowRun,
} from './harnessWorkflowRunContract.js';
import {
  buildFailureClassification,
  buildObservedGateResult,
  normalizeLocalHarnessExecutionMode,
} from './harnessObservedContractPolicy.js';
import { buildReportPublicationDecision } from './reportPublicationPolicy.js';
import { scheduleHarnessRunPersistence } from './interviewNextTurnShadowHarness.js';
import {
  buildHarnessExecutionControlContext,
  buildObservedWriteGateDecisions,
  completeHarnessExecutionControls,
  createObservedCapabilityRegistry,
} from './harnessExecutableControls.js';
import { runWithUsageContextPatch } from '../deepseekService.js';

const hashRef = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

const normalizeVersionRef = (value, fallback = 'current') => {
  if (!value) return fallback;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString();
  return String(value);
};

const buildSource = ({ sourceType, sourceRef, sourceVersion = 'current' }) => ({
  sourceType,
  sourceRef,
  sourceVersion,
  sourceHash: hashRef({ sourceType, sourceRef, sourceVersion }),
  trustLevel: 'owned',
  reviewStatus: 'system_derived',
});

const buildReportContextSources = (session = {}, taskType) => {
  const sources = [
    buildSource({ sourceType: 'session', sourceRef: `session:${session.id}` }),
    buildSource({ sourceType: 'transcript', sourceRef: `session_transcript:${session.id}`, sourceVersion: String(session.transcript?.length || 0) }),
    buildSource({ sourceType: 'interview_plan', sourceRef: `interview_plan:${session.id}`, sourceVersion: session.interviewPlan?.schemaVersion || 'current' }),
  ];
  if (session.cvFileId) sources.push(buildSource({ sourceType: 'cv_profile', sourceRef: `cv_file:${session.cvFileId}` }));
  if (session.jdFingerprint) sources.push(buildSource({ sourceType: 'jd_rubric', sourceRef: `jd_fingerprint:${session.jdFingerprint}` }));
  if (taskType === 'qa_report') sources.push(buildSource({ sourceType: 'report', sourceRef: `session_report:${session.id}` }));
  return sources;
};

const buildReportFailure = ({ workflowRunId, evaluatedAt, publicationDecision }) => {
  if (publicationDecision.qualityStatus !== 'blocked') return [];
  return [buildFailureClassification({
    failureId: `failure:${workflowRunId}:report_verification`,
    workflowRunId,
    subjectRef: `gate:${workflowRunId}:report_publication_allowed`,
    occurredAt: evaluatedAt,
    stage: 'report_verification',
    category: 'verification_failure',
    reasonCode: 'report_publication_blocked_by_qa',
    handled: true,
    expected: true,
    retryable: false,
    fallbackApplied: false,
    userImpact: 'publication_blocked',
    humanReviewRequired: true,
  })];
};

const toFlagCodes = (qaResult = {}) => [...new Set(
  (Array.isArray(qaResult.qualityFlags) ? qaResult.qualityFlags : [])
    .map((flag) => String(flag || '').trim())
    .filter((flag) => /^[a-z0-9_:-]{1,120}$/i.test(flag))
)].slice(0, 50);

const buildRepairExecutionArtifacts = ({
  workflowRunId,
  executionMode,
  taskType,
  contextPacketId,
  parentActionContractId,
  repairHistory = [],
  completedAt,
} = {}) => {
  const attempts = Array.isArray(repairHistory) ? repairHistory : [];
  const actions = [];
  const gates = [];
  const failures = [];
  const timeline = [];

  attempts.forEach((repair, index) => {
    const attempt = Number.isInteger(Number(repair?.attempt)) && Number(repair.attempt) > 0
      ? Number(repair.attempt)
      : index + 1;
    const actionContractId = `action_contract:${workflowRunId}:report_repair:${attempt}`;
    const gateResultId = `gate:${workflowRunId}:report_repair:${attempt}`;
    const startedAt = normalizeVersionRef(repair?.startedAt || repair?.createdAt || completedAt);
    const endedAt = normalizeVersionRef(repair?.completedAt || repair?.createdAt || completedAt);
    const repaired = repair?.status === 'repaired';
    const status = repaired ? 'completed' : 'failed';

    actions.push({
      actionContractId,
      schemaVersion: 'action_contract_v0',
      workflowRunId,
      parentActionContractRef: parentActionContractId,
      actionType: 'REPAIR_REPORT_DRAFT',
      selectedAction: 'REPAIR_REPORT_DRAFT',
      contractVersion: 'report_repair_action_v0',
      allowedTaskTypes: [taskType],
      allowedCallerRefs: ['report_qa_repair_orchestrator'],
      riskClass: 'high',
      preconditions: ['report_qa_failed', 'bounded_repair_instruction_available'],
      requiredInputRefs: [
        contextPacketId,
        `qa_result:${workflowRunId}:repair:${attempt}:before`,
      ],
      forbiddenBehaviors: [
        'invent_candidate_evidence',
        'change_deterministic_score',
        'skip_post_repair_qa',
        'publish_without_final_gate',
      ],
      postconditions: ['repaired_draft_recorded', 'post_repair_qa_recorded'],
      sideEffects: { allowedTargets: ['report_draft'], requiresAuditRef: true },
      idempotency: { required: true, scope: 'parent_run_repair_attempt' },
      retryPolicy: { maxAttempts: 0, retryableReasons: [] },
      fallbackPolicy: { fallbackActionType: null, failClosed: false },
      requiredGateTypes: ['report_repair_attempt_verified'],
      repairAttempt: attempt,
      repairInstructionPresent: Boolean(String(repair?.repairInstruction || '').trim()),
      qaBeforeFlagCodes: toFlagCodes(repair?.qaBefore),
      qaAfterFlagCodes: toFlagCodes(repair?.qaAfter),
      executionStatus: status,
      startedAt,
      completedAt: endedAt,
      resultRefs: [
        `report_draft:${workflowRunId}:repair:${attempt}:after`,
        `qa_result:${workflowRunId}:repair:${attempt}:after`,
      ],
    });
    gates.push(buildObservedGateResult({
      gateResultId,
      workflowRunId,
      gateType: 'report_repair_attempt_verified',
      executionMode,
      evaluatedAt: endedAt,
      evaluatorRef: 'report_qa_policy_adapter',
      subjectRef: actionContractId,
      status: repaired ? 'pass' : 'review',
      reasonCodes: [repaired ? 'report_repair_passed_post_qa' : 'report_repair_failed_post_qa'],
      blockingScope: 'none',
      humanReadableSummary: repaired
        ? 'The observed report repair passed its follow-up QA check.'
        : 'The observed report repair did not pass its follow-up QA check.',
      nextStep: { type: repaired ? 'continue' : 'retry', ref: null },
      enforced: false,
      enforcementSource: 'harness_observe_only',
    }));
    if (!repaired) {
      failures.push(buildFailureClassification({
        failureId: `failure:${workflowRunId}:report_repair:${attempt}`,
        workflowRunId,
        subjectRef: actionContractId,
        occurredAt: endedAt,
        stage: 'report_repair_verification',
        category: 'verification_failure',
        reasonCode: 'report_repair_failed_post_qa',
        handled: true,
        expected: true,
        retryable: index < attempts.length - 1,
        fallbackApplied: true,
        fallbackRef: index < attempts.length - 1
          ? `action_contract:${workflowRunId}:report_repair:${attempts[index + 1]?.attempt || attempt + 1}`
          : `gate:${workflowRunId}:report_publication_allowed`,
        userImpact: 'none',
      }));
    }
    timeline.push(
      { eventType: 'report_repair_action_started', at: startedAt, ref: actionContractId },
      {
        eventType: repaired ? 'report_repair_action_completed' : 'report_repair_action_failed',
        at: endedAt,
        ref: actionContractId,
      },
    );
  });

  return { actions, gates, failures, timeline };
};

export const buildReportWorkflowRun = ({
  workflowRunId,
  executionMode = 'shadow',
  taskType,
  session = {},
  observation = {},
  result = {},
  controllerError = null,
  executionControlContext = null,
  capabilityEvents = [],
  usageEvents = [],
  startedAt,
  completedAt,
} = {}) => {
  const normalizedMode = normalizeLocalHarnessExecutionMode(executionMode);
  const actionType = taskType === 'qa_report' ? 'QA_REPORT' : 'GENERATE_REPORT_DRAFT';
  const repairHistory = observation.repairHistory || result.repairHistory || [];
  const publicationDecision = buildReportPublicationDecision({
    workflowRunId,
    executionMode: normalizedMode,
    qaResult: observation.qaResult || result.qaResult || {},
    repairHistory,
    evaluatedAt: completedAt,
  });
  const contextPacketId = `context_packet:${workflowRunId}`;
  const actionContractId = `action_contract:${workflowRunId}`;
  const repairArtifacts = buildRepairExecutionArtifacts({
    workflowRunId,
    executionMode: normalizedMode,
    taskType,
    contextPacketId,
    parentActionContractId: actionContractId,
    repairHistory,
    completedAt,
  });
  const gateResults = [...repairArtifacts.gates, publicationDecision.gateResult];
  const failures = controllerError
    ? [buildFailureClassification({
        failureId: `failure:${workflowRunId}:controller_execution`,
        workflowRunId,
        occurredAt: completedAt,
        stage: 'report_controller_execution',
        category: 'action_policy_failure',
        reasonCode: `${taskType}_controller_failed`,
        handled: false,
        expected: false,
        retryable: false,
        fallbackApplied: false,
        userImpact: 'action_blocked',
      })]
    : [
        ...repairArtifacts.failures,
        ...buildReportFailure({ workflowRunId, evaluatedAt: completedAt, publicationDecision }),
      ];
  const contextPackets = [{
    contextPacketId,
    workflowRunId,
    taskType,
    schemaVersion: 'context_packet_v0',
    contractVersion: `${taskType}_context_v0`,
    purpose: taskType === 'qa_report' ? 'verify_existing_report' : 'generate_and_verify_report',
    assembledAt: startedAt,
    assemblerComponent: 'report_workflow_harness',
    storageMode: 'refs_hash_version_only',
    rawSnapshotAllowed: false,
    redactionPolicyVersion: HARNESS_REDACTION_POLICY_VERSION,
    sources: buildReportContextSources(session, taskType),
  }];
  const actionContracts = [{
    actionContractId,
    schemaVersion: 'action_contract_v0',
    workflowRunId,
    actionType,
    selectedAction: actionType,
    contractVersion: `${taskType}_action_v0`,
    allowedTaskTypes: [taskType],
    allowedCallerRefs: ['master_ai_controller'],
    riskClass: 'high',
    preconditions: ['owned_session', 'report_evidence_available'],
    requiredInputRefs: [contextPacketId],
    forbiddenBehaviors: ['publish_unverified_critical_claim', 'silent_repair_without_lineage'],
    postconditions: ['qa_result_recorded', 'publication_status_recorded'],
    sideEffects: { allowedTargets: ['session_report', 'session_analysis'], requiresAuditRef: true },
    idempotency: { required: true, scope: 'artifact_version' },
    retryPolicy: { maxAttempts: 0, retryableReasons: [] },
    fallbackPolicy: { fallbackActionType: null, failClosed: false },
    requiredGateTypes: ['report_publication_allowed'],
    repairLineage: publicationDecision.repairLineage,
  }, ...repairArtifacts.actions];
  const reportVersion = normalizeVersionRef(
    result.stored?.updatedAt || result.stored?.latestStatus || publicationDecision.publicationStatus,
  );
  const resultRefs = result.report || result.stored
    ? [`session_report:${session.id}:${reportVersion}`]
    : [];
  const lifecycleStatus = controllerError ? 'failed' : 'completed';
  const qualityStatus = controllerError ? 'invalid' : publicationDecision.qualityStatus;
  const publicationStatus = controllerError ? 'draft' : publicationDecision.publicationStatus;
  const writeGateDecisions = buildObservedWriteGateDecisions({
    workflowRunId,
    taskType,
    ownerUserId: session.userId,
    sessionId: session.id,
    publicationStatus,
    memoryWrites: [],
    evaluatedAt: completedAt,
  });
  const executionControls = completeHarnessExecutionControls({
    context: executionControlContext || buildHarnessExecutionControlContext({
      workflowRunId,
      taskType,
      session,
      executionMode: normalizedMode,
      evaluatedAt: startedAt,
    }),
    completedAt,
    lifecycleStatus,
    qualityStatus,
    publicationStatus,
    domainResultRef: resultRefs[0] || null,
    controllerError,
    capabilityEvents,
    usageEvents,
    writeGateDecisions,
  });

  return {
    workflowRunId,
    idempotencyKey: buildHarnessIdempotencyKey({ taskType, sessionId: session.id, clientTurnId: String(reportVersion) }),
    taskType,
    executionMode: normalizedMode,
    ownerUserId: session.userId,
    sessionId: session.id,
    clientTurnId: null,
    channel: session.mode === 'voice' ? 'voice' : 'text',
    lifecycleStatus,
    qualityStatus,
    publicationStatus,
    taskContract: {
      ...executionControls.taskContract,
      taskContractRef: `${taskType}_v0`,
      taskType,
      ownerComponent: 'master_ai_controller',
      objective: taskType === 'qa_report' ? 'verify_report_quality' : 'generate_grounded_report',
      workflowKind: 'agent_task',
      executionMode: normalizedMode,
      authority: 'current_controller',
      allowedChannels: ['text', 'voice'],
      requiredGateTypes: [
        ...(repairArtifacts.gates.length ? ['report_repair_attempt_verified'] : []),
        'report_publication_allowed',
      ],
      forbiddenBehaviors: ['treat_completed_as_published', 'expose_internal_qa_trace_to_candidate'],
    },
    contextPackets,
    actionContracts,
    gateResults,
    memoryWrites: [],
    failures,
    stateRefs: {
      before: { stateName: 'report_state_before', stateRef: `session_report:${session.id}:before`, stateVersion: 'report_state_v0' },
      after: { stateName: 'report_state_after', stateRef: `session_report:${session.id}:${publicationDecision.publicationStatus}`, stateVersion: 'report_state_v0' },
    },
    contextPacketRefs: [contextPacketId],
    actionContractRefs: actionContracts.map((action) => action.actionContractId),
    gateResultRefs: gateResults.map((gate) => gate.gateResultId),
    memoryWriteRefs: [],
    failureRefs: failures.map((failure) => failure.failureId),
    resultRefs,
    executionControls,
    timeline: [
      { eventType: 'workflow_run_started', at: startedAt, ref: workflowRunId },
      { eventType: 'context_packet_assembled', at: startedAt, ref: contextPacketId },
      { eventType: 'action_selected', at: startedAt, ref: actionContractId },
      ...repairArtifacts.timeline,
      {
        eventType: 'report_publication_gate_evaluated',
        at: completedAt,
        ref: publicationDecision.gateResult.gateResultId,
      },
      { eventType: controllerError ? 'workflow_run_failed' : 'workflow_run_completed', at: completedAt, ref: workflowRunId },
      ...executionControls.events,
    ],
    latency: { controllerMs: Math.max(0, new Date(completedAt).getTime() - new Date(startedAt).getTime()) },
    privacy: {
      rawSnapshotAllowed: false,
      redactionPolicyVersion: HARNESS_REDACTION_POLICY_VERSION,
      retentionClass: 'session_source_bounded',
      sourceDeletionHandling: 'follow_session_retention_policy',
    },
    startedAt,
    completedAt,
    retentionUntil: buildRetentionExpiry(new Date(startedAt)),
    deletedAt: null,
    containsSensitiveData: true,
    accessScope: 'developer_private',
    schemaVersion: 'workflow_run_v0',
  };
};

const noOp = () => {};

export const runReportTaskWithHarness = async ({
  enabled,
  executionMode = 'shadow',
  taskType,
  session,
  capabilityRegistry = null,
  executeController,
  appendRun = scheduleHarnessRunPersistence,
  workflowRunIdFactory = crypto.randomUUID,
  now = () => new Date(),
  withUsageContext = runWithUsageContextPatch,
} = {}) => {
  if (!enabled) return executeController({ workflowRunId: null, observe: noOp });
  const workflowRunId = workflowRunIdFactory();
  const startedAt = now().toISOString();
  const executionControlContext = buildHarnessExecutionControlContext({
    workflowRunId,
    taskType,
    session,
    executionMode,
    ...(capabilityRegistry
      ? { availableCapabilityIds: Object.keys(capabilityRegistry) }
      : {}),
    evaluatedAt: startedAt,
  });
  const capabilityObservation = capabilityRegistry
    ? createObservedCapabilityRegistry({
        workflowRunId,
        registry: capabilityRegistry,
        now,
        withUsageContext,
      })
    : {
        registry: null,
        events: [],
        usageEvents: [],
        recordUsage: noOp,
      };
  let observation = {};
  const observe = (value = {}) => { observation = value; };
  try {
    const result = await withUsageContext({
      userId: session.userId,
      sessionId: session.id,
      workflowRunId,
      harnessUsageCollector: capabilityObservation.recordUsage,
    }, () => executeController({
      workflowRunId,
      observe,
      capabilityRegistry: capabilityObservation.registry,
    }));
    const completedAt = now().toISOString();
    const run = buildReportWorkflowRun({
      workflowRunId,
      executionMode,
      taskType,
      session,
      observation,
      result,
      executionControlContext,
      capabilityEvents: capabilityObservation.events,
      usageEvents: capabilityObservation.usageEvents,
      startedAt,
      completedAt,
    });
    const validation = validateHarnessWorkflowRun(run);
    if (!validation.valid) {
      logger.error('Report harness contract validation failed', {
        workflowRunId,
        taskType,
        validationErrors: validation.errors,
      });
    }
    await appendRun(run);
    return result;
  } catch (error) {
    const completedAt = now().toISOString();
    const run = buildReportWorkflowRun({
      workflowRunId,
      executionMode,
      taskType,
      session,
      controllerError: error,
      executionControlContext,
      capabilityEvents: capabilityObservation.events,
      usageEvents: capabilityObservation.usageEvents,
      startedAt,
      completedAt,
    });
    try {
      await appendRun(run);
    } catch (recordingError) {
      logger.error('Report harness recording failed', {
        workflowRunId,
        taskType,
        errorName: recordingError?.name || 'Error',
      });
    }
    throw error;
  }
};
