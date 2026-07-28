import crypto from 'crypto';

import { buildRetentionExpiry } from '../retention/retentionPolicy.js';
import {
  buildFailureClassification,
  buildObservedGateResult,
  HARNESS_MEMORY_POLICY_VERSION,
  normalizeLocalHarnessExecutionMode,
  validateFailureClassification,
  validateObservedGateResult,
} from './harnessObservedContractPolicy.js';
import {
  buildHarnessExecutionControlContext,
  buildObservedWriteGateDecisions,
  completeHarnessExecutionControls,
  validateHarnessExecutionControls,
} from './harnessExecutableControls.js';

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

const buildContextSources = (session = {}, userInterviewMemory = null) => {
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
  if (userInterviewMemory?.schemaVersion) {
    sources.push(buildSourceRef({
      sourceType: 'user_interview_memory',
      sourceRef: `session_memory_projection:${session.id}`,
      sourceVersion: userInterviewMemory.generatedAt || userInterviewMemory.policyVersion || 'current',
      trustLevel: 'system_derived',
      reviewStatus: 'system_derived',
    }));
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

const FAILURE_CATEGORY_BY_LEGACY_CATEGORY = {
  channel_transport: 'environment_failure',
  controller: 'action_policy_failure',
  contract_validation: 'verification_failure',
  correlation: 'memory_policy_failure',
  harness_recording: 'tool_or_side_effect_failure',
};

const buildFailures = ({
  workflowRunId,
  observation = {},
  controllerError = null,
  preTaskFailure = null,
  occurredAt,
}) => {
  const failures = [];
  if (preTaskFailure) {
    failures.push(buildFailureClassification({
      failureId: `failure:${workflowRunId}:pre_task`,
      workflowRunId,
      occurredAt,
      stage: 'pre_task_channel_eligibility',
      category: FAILURE_CATEGORY_BY_LEGACY_CATEGORY[preTaskFailure.category] || 'environment_failure',
      reasonCode: preTaskFailure.reasonCode || 'voice_turn_rejected',
      handled: true,
      expected: true,
      retryable: Boolean(preTaskFailure.retryable),
      fallbackApplied: false,
      userImpact: preTaskFailure.userImpact || 'turn_retry_required',
    }));
  }
  const modelSelectionError = observation.plan?.modelSelectionError;
  if (modelSelectionError) {
    failures.push(buildFailureClassification({
      failureId: `failure:${workflowRunId}:model_action_selection`,
      workflowRunId,
      subjectRef: `action_contract:${workflowRunId}`,
      occurredAt,
      stage: 'model_action_selection',
      category: 'model_output_failure',
      reasonCode: 'model_action_selection_failed',
      handled: true,
      expected: true,
      retryable: false,
      fallbackApplied: true,
      fallbackRef: `action_contract:${workflowRunId}`,
      userImpact: 'none',
    }));
  }
  if (controllerError) {
    failures.push(buildFailureClassification({
      failureId: `failure:${workflowRunId}:controller_execution`,
      workflowRunId,
      occurredAt,
      stage: 'controller_execution',
      category: 'action_policy_failure',
      reasonCode: 'interview_controller_failed',
      handled: false,
      expected: false,
      retryable: false,
      fallbackApplied: false,
      userImpact: 'action_blocked',
    }));
  }
  return failures;
};

const inferQuestionTurnType = (interviewerOutput = {}) => {
  const turnKind = interviewerOutput.turnKind || interviewerOutput.questionDecision?.turnKind || '';
  const scenario = interviewerOutput.scenario || interviewerOutput.questionDecision?.scenario || '';
  const questionType = interviewerOutput.questionType || '';
  if (questionType === 'transcript_confirmation' || scenario === 'clarify_audio_or_transcript') return 'transcript_confirmation';
  if (questionType === 'question_scope_clarification' || scenario === 'question_scope_clarification') return 'question_scope_clarification';
  if (questionType === 'clarification') return 'clarification';
  if (turnKind === 'repair' || ['rephrase', 'scaffold'].includes(scenario)) return 'repair_prompt';
  if (turnKind === 'system' || questionType === 'system') return 'system';
  return 'interview_question';
};

const buildQuestionCountingDecision = ({ session = {}, observation = {}, result = null }) => {
  if (!result) {
    return { status: 'pass', reasonCodes: ['no_question_result_to_count'], blockingScope: 'none' };
  }
  if (result?.isComplete) {
    return { status: 'pass', reasonCodes: ['terminal_result_not_counted'], blockingScope: 'none' };
  }
  const turnType = inferQuestionTurnType(observation.interviewerOutput);
  const advancedQuestionCount = Number(result?.nextQuestionOrder) > Number(session.currentQuestionIndex ?? -1);
  if (turnType !== 'interview_question' && advancedQuestionCount) {
    return {
      status: 'warn',
      reasonCodes: ['non_interview_turn_advanced_question_count'],
      blockingScope: 'task',
    };
  }
  if (turnType !== 'interview_question') {
    return { status: 'pass', reasonCodes: ['non_interview_turn_not_counted'], blockingScope: 'none' };
  }
  return {
    status: advancedQuestionCount ? 'pass' : 'warn',
    reasonCodes: [advancedQuestionCount ? 'interview_question_count_preserved' : 'interview_question_did_not_advance_count'],
    blockingScope: advancedQuestionCount ? 'none' : 'task',
  };
};

const buildGateResults = ({
  workflowRunId,
  executionMode,
  evaluatedAt,
  session = {},
  payload = {},
  observation = {},
  result = null,
  preTaskFailure = null,
  lifecycleStatus,
}) => {
  if (preTaskFailure) {
    return [buildObservedGateResult({
      gateResultId: `gate:${workflowRunId}:transcript_eligibility`,
      workflowRunId,
      gateType: 'transcript_eligibility',
      executionMode,
      evaluatedAt,
      evaluatorRef: 'voice_transport',
      subjectRef: `client_turn:${payload.clientTurnId || workflowRunId}`,
      status: 'block',
      reasonCodes: [preTaskFailure.reasonCode || 'voice_turn_rejected'],
      blockingScope: 'task',
      humanReadableSummary: 'The voice turn was rejected before interview processing.',
      nextStep: { type: 'retry', ref: null },
      enforced: true,
      enforcementSource: 'existing_voice_controller',
    })];
  }
  const selectedAction = observation.plan?.selectedAction || result?.controllerAction || null;
  const candidateActions = sanitizeCandidateActions(observation.plan?.candidateActions);
  const selectedIsAllowed = !selectedAction || candidateActions.length === 0
    || candidateActions.some((candidate) => candidate.action === selectedAction);
  const rejectedCandidates = observation.interviewerOutput?.questionDecision?.rejectedCandidates || [];
  const selectedDuplicate = Boolean(
    observation.interviewerOutput?.questionDecision?.deduplication?.selectedWasDuplicate
    || observation.interviewerOutput?.questionDecision?.deduplication?.duplicateOverride
  );
  const isVoice = ['duplex_voice', 'realtime_voice'].includes(payload.inputMode);
  const countingDecision = buildQuestionCountingDecision({ session, observation, result });
  const waitingForVoiceConfirmation = lifecycleStatus === 'waiting' && isVoice;

  return [
    buildObservedGateResult({
      gateResultId: `gate:${workflowRunId}:action_allowed_candidate`,
      workflowRunId,
      gateType: 'action_allowed_candidate',
      executionMode,
      evaluatedAt,
      evaluatorRef: 'interview_controller',
      subjectRef: `action_contract:${workflowRunId}`,
      status: selectedIsAllowed ? 'pass' : 'warn',
      reasonCodes: [selectedIsAllowed ? 'selected_action_allowed' : 'selected_action_fell_back'],
      blockingScope: selectedIsAllowed ? 'none' : 'action',
      humanReadableSummary: selectedIsAllowed
        ? 'The selected action was within the controller candidate set.'
        : 'The selected action required the existing bounded fallback.',
      nextStep: { type: selectedIsAllowed ? 'continue' : 'fallback', ref: `action_contract:${workflowRunId}` },
      enforced: false,
    }),
    buildObservedGateResult({
      gateResultId: `gate:${workflowRunId}:question_counting`,
      workflowRunId,
      gateType: 'question_counting',
      executionMode,
      evaluatedAt,
      evaluatorRef: 'interview_controller',
      subjectRef: result ? `result:${workflowRunId}` : `workflow_run:${workflowRunId}`,
      ...countingDecision,
      humanReadableSummary: countingDecision.status === 'pass'
        ? 'Question counting matched the observed turn type.'
        : 'Question counting did not match the observed turn type.',
      nextStep: { type: 'continue', ref: null },
      enforced: false,
    }),
    buildObservedGateResult({
      gateResultId: `gate:${workflowRunId}:question_novelty`,
      workflowRunId,
      gateType: 'question_novelty',
      executionMode,
      evaluatedAt,
      evaluatorRef: 'question_ranker',
      subjectRef: `result:${workflowRunId}`,
      status: selectedDuplicate ? 'warn' : 'pass',
      reasonCodes: [selectedDuplicate
        ? 'duplicate_question_selected'
        : rejectedCandidates.length ? 'duplicate_candidates_rejected' : 'no_duplicate_rejection_recorded'],
      blockingScope: selectedDuplicate ? 'action' : 'none',
      humanReadableSummary: selectedDuplicate
        ? 'The selected question was flagged as a duplicate.'
        : 'No duplicate question reached the selected result.',
      nextStep: { type: selectedDuplicate ? 'fallback' : 'continue', ref: null },
      enforced: false,
    }),
    buildObservedGateResult({
      gateResultId: `gate:${workflowRunId}:transcript_eligibility`,
      workflowRunId,
      gateType: 'transcript_eligibility',
      executionMode,
      evaluatedAt,
      evaluatorRef: isVoice ? 'voice_transcript_policy' : 'text_answer_validation',
      subjectRef: `client_turn:${payload.clientTurnId || workflowRunId}`,
      status: waitingForVoiceConfirmation ? 'review' : 'pass',
      reasonCodes: [waitingForVoiceConfirmation
        ? 'voice_transcript_confirmation_pending'
        : isVoice ? 'voice_answer_accepted_before_controller' : 'text_answer_validated'],
      blockingScope: waitingForVoiceConfirmation ? 'scoring' : 'none',
      humanReadableSummary: waitingForVoiceConfirmation
        ? 'The voice transcript is waiting for user confirmation before scoring.'
        : 'The answer was eligible for the current controller path.',
      nextStep: waitingForVoiceConfirmation
        ? { type: 'wait_for_review', ref: workflowRunId }
        : { type: 'continue', ref: null },
      humanReviewRef: waitingForVoiceConfirmation ? `user_confirmation:${workflowRunId}` : null,
      enforced: false,
      enforcementSource: waitingForVoiceConfirmation ? 'existing_voice_controller' : 'harness_observe_only',
    }),
    buildObservedGateResult({
      gateResultId: `gate:${workflowRunId}:memory_write_policy_shadow`,
      workflowRunId,
      gateType: 'memory_write_policy_shadow',
      executionMode,
      evaluatedAt,
      evaluatorRef: 'memory_policy',
      subjectRef: `workflow_run:${workflowRunId}`,
      status: 'pass',
      reasonCodes: ['memory_cannot_affect_scoring'],
      blockingScope: 'none',
      humanReadableSummary: 'Observed memory writes cannot affect candidate scoring.',
      nextStep: { type: 'continue', ref: null },
      enforced: false,
    }),
  ];
};

const buildMemoryWrites = ({ workflowRunId, observation = {} }) => {
  if (!observation.decisionContext && !observation.plan) return [];
  if (
    observation.interviewerOutput?.questionType === 'question_scope_clarification'
    || observation.interviewerOutput?.scenario === 'question_scope_clarification'
  ) return [];

  const buildWrite = ({ memoryType, scope, memoryCategory, sourceRefs, writerRef, allowedReaders }) => ({
    schemaVersion: 'memory_write_v0',
    memoryWriteId: `memory_write:${workflowRunId}:session_agent_memory`,
    workflowRunId,
    sourceTaskType: 'interview_next_turn',
    sourceTurnId: null,
    sourceEvidenceRefs: sourceRefs,
    writerRef,
    scope,
    memoryType,
    memoryCategory,
    operation: 'upsert',
    status: 'scheduled',
    auditStatus: 'proposed',
    sourceWorkflowRunId: workflowRunId,
    sourceRefs,
    policyVersion: HARNESS_MEMORY_POLICY_VERSION,
    policy: {
      allowedReaders,
      canAffectPlanning: scope === 'session',
      canAffectQuestionSelection: scope === 'session',
      canAffectQuestionDepth: scope === 'session',
      canSuppressRoutineRepeat: false,
      canAffectScoring: false,
      candidateVisible: false,
      retentionClass: scope === 'session' ? 'session_source_bounded' : 'derived_user_coaching_memory',
      sourceDeletePolicy: scope === 'session' ? 'delete' : 'recompute',
    },
    canAffectScoring: false,
  });

  const writes = [buildWrite({
    memoryType: 'session_agent_memory',
    scope: 'session',
    memoryCategory: 'topic_history',
    sourceRefs: [`state_after:${workflowRunId}`],
    writerRef: 'agent_memory_service',
    allowedReaders: ['decision_context_builder', 'action_planner', 'report_generator'],
  })];
  if (observation.reflectionRecord) {
    writes.push(
      {
        ...buildWrite({
          memoryType: 'session_reflection',
          scope: 'session',
          memoryCategory: 'reflection_lesson',
          sourceRefs: [`trajectory:${workflowRunId}`],
          writerRef: 'reflection_writer_service',
          allowedReaders: ['experience_memory_service', 'report_generator'],
        }),
        memoryWriteId: `memory_write:${workflowRunId}:session_reflection`,
      },
      {
        ...buildWrite({
          memoryType: 'user_coaching_memory',
          scope: 'user_coaching',
          memoryCategory: 'coaching_summary',
          sourceRefs: [`reflection:${workflowRunId}`],
          writerRef: 'user_coaching_memory_service',
          allowedReaders: ['decision_context_builder', 'report_generator'],
        }),
        memoryWriteId: `memory_write:${workflowRunId}:user_coaching_memory`,
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
  preTaskFailure,
}) => {
  if (preTaskFailure) {
    return [
      { eventType: 'workflow_run_started', at: startedAt, ref: workflowRunId },
      { eventType: 'context_packet_assembled', at: startedAt, ref: `context_packet:${workflowRunId}` },
      { eventType: 'voice_turn_rejected', at: completedAt, ref: `failure:${workflowRunId}:pre_task` },
      { eventType: 'workflow_run_failed', at: completedAt, ref: workflowRunId },
    ];
  }

  return [
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
};

export const buildHarnessIdempotencyKey = ({ taskType, sessionId, clientTurnId }) => hashValue({
  taskType,
  sessionId,
  clientTurnId,
});

export const buildInterviewNextTurnWorkflowRun = ({
  workflowRunId,
  executionMode = 'shadow',
  session = {},
  payload = {},
  observation = {},
  result = null,
  controllerError = null,
  preTaskFailure = null,
  lifecycleStatus = null,
  executionControlContext = null,
  capabilityEvents = [],
  usageEvents = [],
  startedAt = new Date().toISOString(),
  completedAt = new Date().toISOString(),
} = {}) => {
  const normalizedExecutionMode = normalizeLocalHarnessExecutionMode(executionMode);
  const resolvedLifecycleStatus = lifecycleStatus
    || (controllerError ? 'failed' : result ? 'completed' : 'running');
  const contextPacketId = `context_packet:${workflowRunId}`;
  const actionContractId = `action_contract:${workflowRunId}`;
  const clientTurnId = payload.clientTurnId || workflowRunId;
  const normalizedStartedAt = isoString(startedAt);
  const normalizedCompletedAt = isoString(completedAt);
  const failures = buildFailures({
    workflowRunId,
    observation,
    controllerError,
    preTaskFailure,
    occurredAt: normalizedCompletedAt,
  });
  const gateResults = buildGateResults({
    workflowRunId,
    executionMode: normalizedExecutionMode,
    evaluatedAt: normalizedCompletedAt,
    session,
    payload,
    observation,
    result,
    preTaskFailure,
    lifecycleStatus: resolvedLifecycleStatus,
  });
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
    workflowRunId,
    taskType: 'interview_next_turn',
    schemaVersion: 'context_packet_v0',
    contractVersion: 'interview_context_v0',
    purpose: 'select_and_execute_next_interview_action',
    assembledAt: normalizedStartedAt,
    assemblerComponent: 'interview_next_turn_shadow_harness',
    storageMode: 'refs_hash_version_only',
    rawSnapshotAllowed: false,
    redactionPolicyVersion: HARNESS_REDACTION_POLICY_VERSION,
    sources: buildContextSources(session, observation.decisionContext?.userInterviewMemory),
  }];
  const actionContracts = selectedAction || candidateActions.length
    ? [{
        actionContractId,
        schemaVersion: 'action_contract_v0',
        workflowRunId,
        actionType: selectedAction,
        contractVersion: 'interview_action_v0',
        allowedTaskTypes: ['interview_next_turn'],
        allowedCallerRefs: ['master_ai_controller'],
        riskClass: 'medium',
        preconditions: ['session_active', 'controller_candidate_set_available'],
        requiredInputRefs: [contextPacketId],
        forbiddenBehaviors: ['select_action_outside_candidate_set', 'count_repair_as_interview_question'],
        postconditions: ['result_or_terminal_state_recorded', 'state_transition_traceable'],
        sideEffects: {
          allowedTargets: ['session_transcript', 'interview_question', 'session_analysis'],
          requiresAuditRef: true,
        },
        idempotency: { required: true, scope: 'client_turn' },
        deadlineMs: null,
        retryPolicy: { maxAttempts: 0, retryableReasons: [] },
        fallbackPolicy: { fallbackActionType: fallbackAction, failClosed: false },
        requiredGateTypes: ['action_allowed_candidate', 'question_counting', 'question_novelty'],
        candidateActions,
        selectedAction,
        fallbackAction,
        selectionSource: observation.plan?.selectionSource || result?.selectionSource || 'controller',
        modelSelectedAction: observation.plan?.modelSelectedAction || null,
        memoryPolicyDecision: observation.plan?.memoryPolicyDecision
          ? {
              reasonCode: observation.plan.memoryPolicyDecision.reasonCode || null,
              competencyKey: observation.plan.memoryPolicyDecision.competencyKey || null,
              independentSessionCount: Number(observation.plan.memoryPolicyDecision.independentSessionCount || 0),
              canAffectScoring: false,
            }
          : null,
      }]
    : [];
  const resultRefs = result
    ? [`${result.isComplete ? 'terminal_result' : 'session_question'}:${session.id}:${result.nextQuestionOrder ?? session.currentQuestionIndex ?? 'unknown'}`]
    : [];
  const resumedFromWaiting = Boolean(payload.workflowRunId) && resolvedLifecycleStatus !== 'waiting';
  const writeGateDecisions = buildObservedWriteGateDecisions({
    workflowRunId,
    taskType: 'interview_next_turn',
    ownerUserId: session.userId,
    sessionId: session.id,
    publicationStatus: 'not_applicable',
    memoryWrites,
    evaluatedAt: normalizedCompletedAt,
  });
  const executionControls = completeHarnessExecutionControls({
    context: executionControlContext || buildHarnessExecutionControlContext({
      workflowRunId,
      taskType: 'interview_next_turn',
      session,
      executionMode: normalizedExecutionMode,
      evaluatedAt: normalizedStartedAt,
    }),
    completedAt: normalizedCompletedAt,
    lifecycleStatus: resolvedLifecycleStatus,
    qualityStatus: resolvedLifecycleStatus === 'waiting' || resolvedLifecycleStatus === 'running'
      ? 'pending'
      : controllerError ? 'invalid' : 'valid',
    publicationStatus: 'not_applicable',
    domainResultRef: resultRefs[0] || null,
    controllerError,
    capabilityEvents,
    usageEvents,
    writeGateDecisions,
  });

  return {
    workflowRunId,
    idempotencyKey: buildHarnessIdempotencyKey({
      taskType: 'interview_next_turn',
      sessionId: session.id,
      clientTurnId,
    }),
    taskType: 'interview_next_turn',
    executionMode: normalizedExecutionMode,
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
      ...executionControls.taskContract,
      taskType: 'interview_next_turn',
      ownerComponent: 'master_ai_controller',
      objective: 'select_and_execute_the_next_valid_interview_action',
      workflowKind: 'agent_task',
      executionMode: normalizedExecutionMode,
      authority: 'current_controller',
      allowedChannels: ['text', 'voice'],
      requiredContextTypes: ['session', 'transcript', 'interview_plan'],
      allowedActionTypes: candidateActions.map((candidate) => candidate.action),
      requiredGateTypes: gateResults.map((gate) => gate.gateType),
      forbiddenBehaviors: [
        'change_candidate_scoring_from_user_memory',
        'count_repair_or_confirmation_as_interview_question',
        'expose_internal_trace_to_candidate',
      ],
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
    executionControls,
    timeline: [
      ...buildTimeline({
        workflowRunId,
        startedAt: normalizedStartedAt,
        completedAt: normalizedCompletedAt,
        lifecycleStatus: resolvedLifecycleStatus,
        hasCandidates: candidateActions.length > 0,
        usedFallback,
        resumedFromWaiting,
        preTaskFailure,
      }),
      ...executionControls.events,
    ],
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
  (run.gateResults || []).forEach((gate, index) => {
    validateObservedGateResult(gate).forEach((error) => errors.push(`gateResults[${index}]: ${error}`));
  });
  (run.memoryWrites || []).forEach((write, index) => {
    if (write.schemaVersion !== 'memory_write_v0') errors.push(`memoryWrites[${index}]: schemaVersion must be memory_write_v0`);
    if (write.workflowRunId !== run.workflowRunId) errors.push(`memoryWrites[${index}]: workflowRunId must match run`);
    if (!write.policyVersion) errors.push(`memoryWrites[${index}]: policyVersion is required`);
    if (write.canAffectScoring !== false || write.policy?.canAffectScoring !== false) {
      errors.push(`memoryWrites[${index}]: canAffectScoring must be false`);
    }
  });
  (run.failures || []).forEach((failure, index) => {
    validateFailureClassification(failure).forEach((error) => errors.push(`failures[${index}]: ${error}`));
  });
  if (run.executionControls) {
    validateHarnessExecutionControls(run.executionControls)
      .errors
      .forEach((error) => errors.push(`executionControls: ${error}`));
  }
  return { valid: errors.length === 0, errors };
};
