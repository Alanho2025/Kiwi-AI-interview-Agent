import { harnessWorkflowRunRepository } from '../../repositories/harnessWorkflowRunRepository.js';

const toDeveloperTimeline = (run = {}) => ({
  workflowRunId: run.workflowRunId,
  idempotencyKey: run.idempotencyKey,
  taskType: run.taskType,
  executionMode: run.executionMode,
  ownerUserId: run.ownerUserId,
  sessionId: run.sessionId,
  clientTurnId: run.clientTurnId || null,
  channel: run.channel,
  lifecycleStatus: run.lifecycleStatus,
  qualityStatus: run.qualityStatus,
  publicationStatus: run.publicationStatus,
  taskContract: run.taskContract || {},
  stateRefs: run.stateRefs || {},
  contextPackets: run.contextPackets || [],
  actionContracts: run.actionContracts || [],
  gateResults: run.gateResults || [],
  memoryWrites: run.memoryWrites || [],
  failures: run.failures || [],
  resultRefs: run.resultRefs || [],
  timeline: run.timeline || [],
  correlation: run.correlation || {},
  latency: run.latency || {},
  privacy: run.privacy || {},
  startedAt: run.startedAt,
  completedAt: run.completedAt || null,
  schemaVersion: run.schemaVersion,
});

export const queryOwnedHarnessRunTimelines = async ({
  ownerUserId,
  workflowRunId = null,
  sessionId = null,
  startedAfter = null,
  startedBefore = null,
  limit = 25,
  repository = harnessWorkflowRunRepository,
} = {}) => {
  const runs = await repository.findOwnedRuns({
    ownerUserId,
    workflowRunId,
    sessionId,
    startedAfter,
    startedBefore,
    limit,
  });
  return runs.map(toDeveloperTimeline);
};
