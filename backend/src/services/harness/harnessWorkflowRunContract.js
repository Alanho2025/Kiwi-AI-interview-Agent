import crypto from 'crypto';

import { buildRetentionExpiry } from '../retention/retentionPolicy.js';

export const HARNESS_SCHEMA_VERSION = 'workflow_run_v0';
export const INTERVIEW_NEXT_TURN_TASK_CONTRACT = 'interview_next_turn_v0';
export const HARNESS_REDACTION_POLICY_VERSION = 'harness_redaction_v0';

const hashValue = (value) => crypto
  .createHash('sha256')
  .update(JSON.stringify(value))
  .digest('hex');

const isoString = (value) => new Date(value).toISOString();

const buildSourceRef = ({ sourceType, sourceRef, sourceVersion = 'current', trustLevel = 'owned', reviewStatus = 'not_required' }) => ({
  sourceType,
  sourceRef,
  sourceVersion,
  sourceHash: hashValue({ sourceType, sourceRef, sourceVersion }),
  trustLevel,
  reviewStatus,
});

const buildContextSources = (session = {}) => {
  const sources = [
    buildSourceRef({ sourceType: 'session', sourceRef: `session:${session.id}`, sourceVersion: session.updatedAt || 'current' }),
    buildSourceRef({ sourceType: 'transcript', sourceRef: `session_transcript:${session.id}`, sourceVersion: String(session.transcript?.length || 0) }),
    buildSourceRef({ sourceType: 'interview_plan', sourceRef: `interview_plan:${session.id}`, sourceVersion: session.interviewPlan?.schemaVersion || 'current' }),
  ];

  if (session.cvFileId) {
    sources.push(buildSourceRef({ sourceType: 'cv_profile', sourceRef: `cv_file:${session.cvFileId}` }));
  }
  if (session.jdFingerprint) {
    sources.push(buildSourceRef({ sourceType: 'jd_rubric', sourceRef: `jd_fingerprint:${session.jdFingerprint}` }));
  }
  const matchAnalysisId = session.interviewPlan?.strategy?.matchAnalysisId;
  if (matchAnalysisId) {
    sources.push(buildSourceRef({ sourceType: 'match_analysis', sourceRef: `match_analysis:${matchAnalysisId}` }));
  }
  return sources;
};

const findLatestQuestionId = (session = {}) => [...(session.transcript || [])]
  .reverse()
  .find((turn) => turn?.role === 'ai' && turn?.questionId)?.questionId || null;

const buildStateRef = ({ stateName, session = {}, result = null }) => {
  const state = {
    status: result?.isComplete ? 'completed' : session.status,
    currentQuestionIndex: result?.nextQuestionOrder ?? session.currentQuestionIndex ?? null,
    transcriptTurnCount: session.transcript?.length || 0,
    latestQuestionId: findLatestQuestionId(session),
    completedBecause: result?.completedBecause || null,
  };
  return {
    stateName,
    stateRef: `${stateName}:${session.id}:${hashValue(state)}`,
    stateHash: hashValue(state),
    stateVersion: 'session_state_v0',
  };
};

const sanitizeCandidateActions = (actions = []) => actions
  .filter((candidate) => candidate?.action)
  .map((candidate) => ({
    action: candidate.action,
    confidence: Number(candidate.confidence ?? candidate.score ?? 0),
  }));

const buildFailures = ({ workflowRunId, observation = {}, controllerError = null }) => {
  const failures = [];
  const modelSelectionError = observation.plan?.modelSelectionError;
  if (modelSelectionError) {
    failures.push({
      failureId: `failure:${workflowRunId}:model_action_selection`,
      category: 'model_output',
      reasonCode: 'model_action_selection_failed',
      handled: true,
      retryable: false,
      fallbackApplied: true,
      userImpact: 'none',
    });
  }
  if (controllerError) {
    failures.push({
      failureId: `failure:${workflowRunId}:controller_execution`,
      category: 'controller',
      reasonCode: 'interview_controller_failed',
      handled: false,
      retryable: false,
      fallbackApplied: false,
      userImpact: 'turn_failed',
    });
  }
  return failures;
};

const buildGateResults = ({ workflowRunId, payload = {}, observation = {}, result = null }) => {
  const selectedAction = observation.plan?.selectedAction || result?.controllerAction || null;
  const candidateActions = sanitizeCandidateActions(observation.plan?.candidateActions);
  const selectedIsAllowed = !selectedAction || candidateActions.length === 0
    || candidateActions.some((candidate) => candidate.action === selectedAction);
  const rejectedCandidates = observation.interviewerOutput?.questionDecision?.rejectedCandidates || [];
  const isVoice = ['duplex_voice', 'realtime_voice'].includes(payload.inputMode);

  return [
    {
      gateResultId: `gate:${workflowRunId}:action_allowed_candidate`,
      gateType: 'action_allowed_candidate',
      status: selectedIsAllowed ? 'pass' : 'warn',
      owner: 'interview_controller',
      reasonCode: selectedIsAllowed ? 'selected_action_allowed' : 'selected_action_fell_back',
      enforced: false,
    },
    {
      gateResultId: `gate:${workflowRunId}:question_counting`,
      gateType: 'question_counting',
      status: 'pass',
      owner: 'interview_controller',
      reasonCode: result?.isComplete ? 'terminal_result_not_counted' : 'legacy_question_count_preserved',
      enforced: false,
    },
    {
      gateResultId: `gate:${workflowRunId}:question_novelty`,
      gateType: 'question_novelty',
      status: rejectedCandidates.length ? 'warn' : 'pass',
      owner: 'question_ranker',
      reasonCode: rejectedCandidates.length ? 'duplicate_candidates_rejected' : 'no_duplicate_rejection_recorded',
      enforced: false,
    },
    {
      gateResultId: `gate:${workflowRunId}:transcript_eligibility`,
      gateType: 'transcript_eligibility',
      status: 'pass',
      owner: isVoice ? 'voice_transcript_policy' : 'text_answer_validation',
      reasonCode: isVoice ? 'voice_answer_accepted_before_controller' : 'text_answer_validated',
      enforced: false,
    },
    {
      gateResultId: `gate:${workflowRunId}:memory_write_policy_shadow`,
      gateType: 'memory_write_policy_shadow',
      status: 'pass',
      owner: 'memory_policy',
      reasonCode: 'memory_cannot_affect_scoring',
      enforced: false,
    },
  ];
};

const buildMemoryWrites = ({ workflowRunId, observation = {} }) => {
  if (!observation.decisionContext && !observation.plan) return [];

  const writes = [{
    memoryWriteId: `memory_write:${workflowRunId}:session_agent_memory`,
    memoryType: 'session_agent_memory',
    status: 'scheduled',
    sourceWorkflowRunId: workflowRunId,
    sourceRefs: [`state_after:${workflowRunId}`],
    canAffectScoring: false,
  }];
  if (observation.reflectionRecord) {
    writes.push(
      {
        memoryWriteId: `memory_write:${workflowRunId}:session_reflection`,
        memoryType: 'session_reflection',
        status: 'scheduled',
        sourceWorkflowRunId: workflowRunId,
        sourceRefs: [`trajectory:${workflowRunId}`],
        canAffectScoring: false,
      },
      {
        memoryWriteId: `memory_write:${workflowRunId}:user_coaching_memory`,
        memoryType: 'user_coaching_memory',
        status: 'scheduled',
        sourceWorkflowRunId: workflowRunId,
        sourceRefs: [`reflection:${workflowRunId}`],
        canAffectScoring: false,
      }
    );
  }
  return writes;
};

const buildTimeline = ({
  workflowRunId,
  startedAt,
  completedAt,
  lifecycleStatus,
  hasCandidates,
  usedFallback,
  resumedFromWaiting,
}) => [
  ...(resumedFromWaiting
    ? [{ eventType: 'workflow_run_resumed', at: startedAt, ref: workflowRunId }]
    : [
        { eventType: 'workflow_run_started', at: startedAt, ref: workflowRunId },
        { eventType: 'context_packet_assembled', at: startedAt, ref: `context_packet:${workflowRunId}` },
      ]),
  ...(hasCandidates ? [{ eventType: 'candidate_actions_recorded', at: completedAt, ref: `action_contract:${workflowRunId}` }] : []),
  ...(lifecycleStatus === 'waiting'
    ? [{ eventType: 'workflow_run_waiting', at: completedAt, ref: workflowRunId }]
    : [
        { eventType: usedFallback ? 'fallback_action_used' : 'action_selected', at: completedAt, ref: `action_contract:${workflowRunId}` },
        { eventType: 'question_or_terminal_result_recorded', at: completedAt, ref: `result:${workflowRunId}` },
        { eventType: lifecycleStatus === 'failed' ? 'workflow_run_failed' : 'workflow_run_completed', at: completedAt, ref: workflowRunId },
      ]),
];

export const buildHarnessIdempotencyKey = ({ taskType, sessionId, clientTurnId }) => hashValue({
  taskType,
  sessionId,
  clientTurnId,
});

export const buildInterviewNextTurnWorkflowRun = ({
  workflowRunId,
  session = {},
  payload = {},
  observation = {},
  result = null,
  controllerError = null,
  lifecycleStatus = null,
  startedAt = new Date().toISOString(),
  completedAt = new Date().toISOString(),
} = {}) => {
  const resolvedLifecycleStatus = lifecycleStatus
    || (controllerError ? 'failed' : result ? 'completed' : 'running');
  const contextPacketId = `context_packet:${workflowRunId}`;
  const actionContractId = `action_contract:${workflowRunId}`;
  const clientTurnId = payload.clientTurnId || workflowRunId;
  const failures = buildFailures({ workflowRunId, observation, controllerError });
  const gateResults = buildGateResults({ workflowRunId, payload, observation, result });
  const memoryWrites = buildMemoryWrites({ workflowRunId, observation });
  const candidateActions = sanitizeCandidateActions(observation.plan?.candidateActions);
  const selectedAction = observation.plan?.selectedAction || result?.controllerAction || null;
  const fallbackAction = observation.plan?.fallbackAction
    || observation.fallbackPlan?.selectedAction
    || result?.fallbackAction
    || null;
  const usedFallback = Boolean(observation.plan?.modelSelectionError)
    || observation.plan?.selectionSource === 'rule_fallback';
  const contextPackets = [{
    contextPacketId,
    schemaVersion: 'context_packet_v0',
    storageMode: 'refs_hash_version_only',
    rawSnapshotAllowed: false,
    sources: buildContextSources(session),
  }];
  const actionContracts = selectedAction || candidateActions.length
    ? [{
        actionContractId,
        schemaVersion: 'action_contract_v0',
        candidateActions,
        selectedAction,
        fallbackAction,
        selectionSource: observation.plan?.selectionSource || result?.selectionSource || 'controller',
        modelSelectedAction: observation.plan?.modelSelectedAction || null,
      }]
    : [];
  const resultRefs = result
    ? [`${result.isComplete ? 'terminal_result' : 'session_question'}:${session.id}:${result.nextQuestionOrder ?? session.currentQuestionIndex ?? 'unknown'}`]
    : [];
  const normalizedStartedAt = isoString(startedAt);
  const normalizedCompletedAt = isoString(completedAt);
  const resumedFromWaiting = Boolean(payload.workflowRunId) && resolvedLifecycleStatus !== 'waiting';

  return {
    workflowRunId,
    idempotencyKey: buildHarnessIdempotencyKey({
      taskType: 'interview_next_turn',
      sessionId: session.id,
      clientTurnId,
    }),
    taskType: 'interview_next_turn',
    executionMode: 'shadow',
    ownerUserId: session.userId,
    sessionId: session.id,
    clientTurnId,
    channel: ['duplex_voice', 'realtime_voice'].includes(payload.inputMode) ? 'voice' : 'text',
    lifecycleStatus: resolvedLifecycleStatus,
    qualityStatus: resolvedLifecycleStatus === 'waiting' || resolvedLifecycleStatus === 'running'
      ? 'pending'
      : controllerError ? 'invalid' : 'valid',
    publicationStatus: 'not_applicable',
    taskContract: {
      taskContractRef: INTERVIEW_NEXT_TURN_TASK_CONTRACT,
      workflowKind: 'agent_task',
      executionMode: 'shadow',
      authority: 'current_controller',
    },
    contextPackets,
    actionContracts,
    gateResults,
    memoryWrites,
    failures,
    stateRefs: {
      before: buildStateRef({ stateName: 'state_before', session }),
      after: result ? buildStateRef({ stateName: 'state_after', session, result }) : null,
    },
    contextPacketRefs: contextPackets.map((packet) => packet.contextPacketId),
    actionContractRefs: actionContracts.map((action) => action.actionContractId),
    gateResultRefs: gateResults.map((gate) => gate.gateResultId),
    memoryWriteRefs: memoryWrites.map((write) => write.memoryWriteId),
    failureRefs: failures.map((failure) => failure.failureId),
    resultRefs,
    timeline: buildTimeline({
      workflowRunId,
      startedAt: normalizedStartedAt,
      completedAt: normalizedCompletedAt,
      lifecycleStatus: resolvedLifecycleStatus,
      hasCandidates: candidateActions.length > 0,
      usedFallback,
      resumedFromWaiting,
    }),
    latency: {
      controllerMs: Math.max(0, new Date(normalizedCompletedAt).getTime() - new Date(normalizedStartedAt).getTime()),
    },
    privacy: {
      rawSnapshotAllowed: false,
      redactionPolicyVersion: HARNESS_REDACTION_POLICY_VERSION,
      retentionClass: 'session_source_bounded',
      sourceDeletionHandling: 'follow_session_retention_policy',
    },
    startedAt: normalizedStartedAt,
    completedAt: resolvedLifecycleStatus === 'waiting' || resolvedLifecycleStatus === 'running'
      ? null
      : normalizedCompletedAt,
    retentionUntil: buildRetentionExpiry(new Date(normalizedStartedAt)),
    deletedAt: null,
    containsSensitiveData: true,
    accessScope: 'developer_private',
    schemaVersion: HARNESS_SCHEMA_VERSION,
  };
};

const REQUIRED_STRING_FIELDS = [
  'workflowRunId',
  'idempotencyKey',
  'taskType',
  'executionMode',
  'ownerUserId',
  'sessionId',
  'channel',
  'lifecycleStatus',
  'qualityStatus',
  'publicationStatus',
];

const REQUIRED_ARRAY_FIELDS = [
  'contextPackets',
  'actionContracts',
  'gateResults',
  'memoryWrites',
  'failures',
  'contextPacketRefs',
  'actionContractRefs',
  'gateResultRefs',
  'memoryWriteRefs',
  'failureRefs',
  'resultRefs',
];

export const validateHarnessWorkflowRun = (run = {}) => {
  const errors = [];
  REQUIRED_STRING_FIELDS.forEach((field) => {
    if (!String(run[field] || '').trim()) errors.push(`${field} is required`);
  });
  REQUIRED_ARRAY_FIELDS.forEach((field) => {
    if (!Array.isArray(run[field])) errors.push(`${field} must be an array`);
  });
  if (!Array.isArray(run.contextPackets) || run.contextPackets.length === 0) {
    errors.push('contextPackets must contain at least one item');
  }
  if (!run.taskContract?.taskContractRef) errors.push('taskContract.taskContractRef is required');
  if (!run.stateRefs?.before) errors.push('stateRefs.before is required');
  return { valid: errors.length === 0, errors };
};
