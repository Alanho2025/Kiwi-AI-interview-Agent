import crypto from 'crypto';

import { logger } from '../../utils/logger.js';
import { harnessWorkflowRunRepository } from '../../repositories/harnessWorkflowRunRepository.js';
import { enqueueBackgroundJob } from '../../jobs/backgroundJobQueue.js';
import {
  buildInterviewNextTurnWorkflowRun,
  validateHarnessWorkflowRun,
} from './harnessWorkflowRunContract.js';
import { correlateHarnessRunArtifacts } from './harnessRunCorrelationService.js';

const noOp = () => {};

const persistCanonicalRun = async (run) => {
  await harnessWorkflowRunRepository.appendCanonicalRun(run);
  if ((run.timeline || []).some((event) => event.eventType === 'workflow_run_resumed')) {
    await harnessWorkflowRunRepository.finalizeCanonicalRun(run);
  }
};

const reportRecordingFailure = ({ workflowRunId, error, onRecordingFailure = noOp }) => {
  const failure = {
    workflowRunId,
    category: 'harness_recording',
    reasonCode: 'shadow_persistence_failed',
    handled: true,
    retryable: true,
    fallbackApplied: false,
    userImpact: 'none',
    errorName: error?.name || 'Error',
  };
  logger.error('Harness shadow recording failed', failure);
  onRecordingFailure(failure);
};

export const scheduleHarnessRunPersistence = async (run) => {
  enqueueBackgroundJob('persist-harness-workflow-run', async () => {
    try {
      const runToPersist = run.lifecycleStatus === 'completed'
        ? await correlateHarnessRunArtifacts({ run })
        : run;
      await persistCanonicalRun(runToPersist);
    } catch (error) {
      reportRecordingFailure({ workflowRunId: run.workflowRunId, error });
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
    session,
    payload,
    lifecycleStatus: 'waiting',
    startedAt,
    completedAt: startedAt,
  });
  await appendRunSafely({ run, appendRun, onRecordingFailure });
  return { workflowRunId, lifecycleStatus: 'waiting' };
};

export const runInterviewNextTurnWithShadowHarness = async ({
  enabled,
  session,
  payload = {},
  executeController,
  appendRun = persistCanonicalRun,
  onRecordingFailure = noOp,
  workflowRunIdFactory = crypto.randomUUID,
  now = () => new Date(),
} = {}) => {
  if (!enabled) {
    return executeController({ observe: noOp, workflowRunId: null });
  }

  const workflowRunId = payload.workflowRunId || workflowRunIdFactory();
  const startedAt = now().toISOString();
  let observation = {};
  const observe = (nextObservation = {}) => {
    observation = nextObservation;
  };

  try {
    const result = await executeController({ observe, workflowRunId });
    const completedAt = now().toISOString();
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId,
      session,
      payload,
      observation,
      result,
      startedAt,
      completedAt,
    });
    const validation = validateHarnessWorkflowRun(run);
    if (!validation.valid) {
      run.qualityStatus = 'invalid';
      run.failures.push({
        failureId: `failure:${workflowRunId}:contract_validation`,
        category: 'contract_validation',
        reasonCode: 'workflow_run_contract_invalid',
        handled: true,
        retryable: false,
        fallbackApplied: false,
        userImpact: 'none',
        validationErrors: validation.errors,
      });
      run.failureRefs = run.failures.map((failure) => failure.failureId);
    }
    await appendRunSafely({ run, appendRun, onRecordingFailure });
    return result;
  } catch (error) {
    const completedAt = now().toISOString();
    const failedRun = buildInterviewNextTurnWorkflowRun({
      workflowRunId,
      session,
      payload,
      observation,
      controllerError: error,
      startedAt,
      completedAt,
    });
    await appendRunSafely({ run: failedRun, appendRun, onRecordingFailure });
    throw error;
  }
};
