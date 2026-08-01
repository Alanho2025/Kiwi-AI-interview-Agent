import { HarnessWorkflowRun } from '../db/models/harnessWorkflowRunModel.js';

const MAX_QUERY_LIMIT = 100;

const toBoundedLimit = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(Math.floor(parsed), MAX_QUERY_LIMIT);
};

const buildOwnedRunFilter = ({
  ownerUserId,
  workflowRunId,
  sessionId,
  startedAfter,
  startedBefore,
} = {}) => {
  if (!ownerUserId) throw new Error('ownerUserId is required');

  const filter = { ownerUserId, deletedAt: null };
  if (workflowRunId) filter.workflowRunId = workflowRunId;
  if (sessionId) filter.sessionId = sessionId;
  if (startedAfter || startedBefore) {
    filter.startedAt = {};
    if (startedAfter) filter.startedAt.$gte = new Date(startedAfter);
    if (startedBefore) filter.startedAt.$lte = new Date(startedBefore);
  }
  return filter;
};

export const createHarnessWorkflowRunRepository = ({ model = HarnessWorkflowRun } = {}) => ({
  appendCanonicalRun: async (run) => model.findOneAndUpdate(
    { workflowRunId: run.workflowRunId },
    { $setOnInsert: run },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  ),

  finalizeCanonicalRun: async (run) => model.findOneAndUpdate(
    { workflowRunId: run.workflowRunId },
    {
      $set: {
        lifecycleStatus: run.lifecycleStatus,
        qualityStatus: run.qualityStatus,
        completedAt: run.completedAt,
        taskContract: run.taskContract,
        contextPackets: run.contextPackets,
        actionContracts: run.actionContracts,
        gateResults: run.gateResults,
        memoryWrites: run.memoryWrites,
        failures: run.failures,
        stateRefs: run.stateRefs,
        contextPacketRefs: run.contextPacketRefs,
        actionContractRefs: run.actionContractRefs,
        gateResultRefs: run.gateResultRefs,
        memoryWriteRefs: run.memoryWriteRefs,
        failureRefs: run.failureRefs,
        resultRefs: run.resultRefs,
        latency: run.latency,
        privacy: run.privacy,
        executionControls: run.executionControls || {},
        correlation: run.correlation || {},
      },
      $push: {
        timeline: { $each: run.timeline || [] },
      },
    },
    { returnDocument: 'after' }
  ),

  findOwnedRuns: async (filters = {}) => model
    .find(buildOwnedRunFilter(filters))
    .sort({ startedAt: -1 })
    .limit(toBoundedLimit(filters.limit))
    .lean(),
});

export const harnessWorkflowRunRepository = createHarnessWorkflowRunRepository();
