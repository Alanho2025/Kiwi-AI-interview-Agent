import crypto from 'crypto';

import { logger } from '../../utils/logger.js';
import { harnessWorkflowRunRepository } from '../../repositories/harnessWorkflowRunRepository.js';
import { enqueueBackgroundJob } from '../../jobs/backgroundJobQueue.js';
import {
  buildInterviewNextTurnWorkflowRun,
  validateHarnessWorkflowRun,
} from './harnessWorkflowRunContract.js';
import { correlateHarnessRunArtifacts } from './harnessRunCorrelationService.js';
import { emitHarnessRunTrace } from './harnessRunTraceService.js';
import { buildFailureClassification } from './harnessObservedContractPolicy.js';
import {
  buildHarnessExecutionControlContext,
  createObservedCapabilityRegistry,
} from './harnessExecutableControls.js';
import { runWithUsageContextPatch } from '../deepseekService.js';

const noOp = () => {};

const persistCanonicalRun = async (run) => {
  await harnessWorkflowRunRepository.appendCanonicalRun(run);
  if ((run.timeline || []).some((event) => event.eventType === 'workflow_run_resumed')) {
    await harnessWorkflowRunRepository.finalizeCanonicalRun(run);
  }
};

const reportRecordingFailure = ({ workflowRunId, error, onRecordingFailure = noOp }) => {
  const failure = buildFailureClassification({
    failureId: `failure:${workflowRunId}:shadow_persistence`,
    workflowRunId,
    occurredAt: new Date().toISOString(),
    stage: 'shadow_persistence',
    category: 'tool_or_side_effect_failure',
    reasonCode: 'shadow_persistence_failed',
    handled: true,
    expected: false,
    retryable: true,
    fallbackApplied: false,
    userImpact: 'none',
    errorName: error?.name || 'Error',
  });
  logger.error('Harness shadow recording failed', failure);
  onRecordingFailure(failure);
  return failure;
};

const emitHarnessRunTraceSafely = ({ run, traceStage, persistenceStatus }) => {
  try {
    emitHarnessRunTrace({ run, traceStage, persistenceStatus });
  } catch (error) {
    logger.error('Harness workflow trace emission failed', {
      workflowRunId: run?.workflowRunId || null,
      sessionId: run?.sessionId || null,
      traceStage,
      errorName: error?.name || 'Error',
    });
  }
};

export const scheduleHarnessRunPersistence = async (run) => {
  emitHarnessRunTraceSafely({
    run,
    traceStage: 'task_completed',
    persistenceStatus: 'queued',
  });
  enqueueBackgroundJob('persist-harness-workflow-run', async () => {
    try {
      const runToPersist = run.lifecycleStatus === 'completed'
        ? await correlateHarnessRunArtifacts({ run })
        : run;
      await persistCanonicalRun(runToPersist);
      emitHarnessRunTraceSafely({
        run: runToPersist,
        traceStage: 'durable_persisted',
        persistenceStatus: 'persisted',
      });
    } catch (error) {
      const failure = reportRecordingFailure({ workflowRunId: run.workflowRunId, error });
      emitHarnessRunTraceSafely({
        run: {
          ...run,
          qualityStatus: 'invalid',
          failures: [...(run.failures || []), failure],
        },
        traceStage: 'persistence_failed',
        persistenceStatus: 'failed',
      });
    }
  }, {
    workflowRunId: run.workflowRunId,
    sessionId: run.sessionId,
    ownerUserId: run.ownerUserId,
    taskType: run.taskType,
  });
};

const appendRunSafely = async ({ run, appendRun, onRecordingFailure }) => {
  try {
    await appendRun(run);
  } catch (error) {
    reportRecordingFailure({ workflowRunId: run.workflowRunId, error, onRecordingFailure });
  }
};

export const beginWaitingInterviewNextTurnRun = async ({
  enabled,
  executionMode = 'shadow',
  session,
  payload = {},
  appendRun = persistCanonicalRun,
  onRecordingFailure = noOp,
  workflowRunIdFactory = crypto.randomUUID,
  now = () => new Date(),
} = {}) => {
  if (!enabled) return { workflowRunId: null, lifecycleStatus: 'disabled' };

  const workflowRunId = payload.workflowRunId || workflowRunIdFactory();
  const startedAt = now().toISOString();
  const run = buildInterviewNextTurnWorkflowRun({
    workflowRunId,
    executionMode,
    session,
    payload,
    lifecycleStatus: 'waiting',
    startedAt,
    completedAt: startedAt,
  });
  await appendRunSafely({ run, appendRun, onRecordingFailure });
  return { workflowRunId, lifecycleStatus: 'waiting' };
};

export const recordRejectedInterviewNextTurnRun = async ({
  enabled,
  executionMode = 'shadow',
  session,
  payload = {},
  failure = {},
  appendRun = scheduleHarnessRunPersistence,
  onRecordingFailure = noOp,
  workflowRunIdFactory = crypto.randomUUID,
  now = () => new Date(),
} = {}) => {
  if (!enabled) return { workflowRunId: null, lifecycleStatus: 'disabled' };

  const workflowRunId = payload.workflowRunId || workflowRunIdFactory();
  const at = now().toISOString();
  const run = buildInterviewNextTurnWorkflowRun({
    workflowRunId,
    executionMode,
    session,
    payload,
    preTaskFailure: failure,
    lifecycleStatus: 'failed',
    startedAt: at,
    completedAt: at,
  });
  const validation = validateHarnessWorkflowRun(run);
  if (!validation.valid) {
    run.qualityStatus = 'invalid';
  }
  await appendRunSafely({ run, appendRun, onRecordingFailure });
  return { workflowRunId, lifecycleStatus: 'failed' };
};

export const runInterviewNextTurnWithShadowHarness = async ({
  enabled,
  executionMode = 'shadow',
  session,
  payload = {},
  capabilityRegistry = null,
  executeController,
  appendRun = persistCanonicalRun,
  onRecordingFailure = noOp,
  workflowRunIdFactory = crypto.randomUUID,
  now = () => new Date(),
  withUsageContext = runWithUsageContextPatch,
} = {}) => {
  if (!enabled) {
    return executeController({ observe: noOp, workflowRunId: null });
  }

  const workflowRunId = payload.workflowRunId || workflowRunIdFactory();
  const startedAt = now().toISOString();
  const executionControlContext = buildHarnessExecutionControlContext({
    workflowRunId,
    taskType: 'interview_next_turn',
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
  const observe = (nextObservation = {}) => {
    observation = nextObservation;
  };

  try {
    const result = await withUsageContext({
      userId: session.userId,
      sessionId: session.id,
      workflowRunId,
      harnessUsageCollector: capabilityObservation.recordUsage,
    }, () => executeController({
      observe,
      workflowRunId,
      capabilityRegistry: capabilityObservation.registry,
    }));
    const completedAt = now().toISOString();
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId,
      executionMode,
      session,
      payload,
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
      run.qualityStatus = 'invalid';
      run.failures.push(buildFailureClassification({
        failureId: `failure:${workflowRunId}:contract_validation`,
        workflowRunId,
        occurredAt: completedAt,
        stage: 'contract_validation',
        category: 'verification_failure',
        reasonCode: 'workflow_run_contract_invalid',
        handled: true,
        expected: false,
        retryable: false,
        fallbackApplied: false,
        userImpact: 'none',
        validationErrors: validation.errors,
      }));
      run.failureRefs = run.failures.map((failure) => failure.failureId);
    }
    await appendRunSafely({ run, appendRun, onRecordingFailure });
    return result;
  } catch (error) {
    const completedAt = now().toISOString();
    const failedRun = buildInterviewNextTurnWorkflowRun({
      workflowRunId,
      executionMode,
      session,
      payload,
      observation,
      controllerError: error,
      executionControlContext,
      capabilityEvents: capabilityObservation.events,
      usageEvents: capabilityObservation.usageEvents,
      startedAt,
      completedAt,
    });
    await appendRunSafely({ run: failedRun, appendRun, onRecordingFailure });
    throw error;
  }
};
