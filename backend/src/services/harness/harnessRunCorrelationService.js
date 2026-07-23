import { SessionAnalysis } from '../../db/models/sessionAnalysisModel.js';
import { UserCoachingMemory } from '../../db/models/userCoachingMemoryModel.js';
import { buildFailureClassification } from './harnessObservedContractPolicy.js';

const matchesRun = (record, workflowRunId, field = 'workflowRunId') => record?.[field] === workflowRunId;

const hasMemoryWriteOutcome = ({ write, workflowRunId, sessionAnalysis, userCoachingMemory }) => {
  if (write.memoryType === 'session_agent_memory') {
    return sessionAnalysis?.agentMemory?.sourceWorkflowRunId === workflowRunId;
  }
  if (write.memoryType === 'session_reflection') {
    return (sessionAnalysis?.reflectionRecords || [])
      .some((record) => matchesRun(record, workflowRunId, 'sourceWorkflowRunId'));
  }
  if (write.memoryType === 'user_coaching_memory') {
    return (userCoachingMemory?.memoryRecords || [])
      .some((record) => matchesRun(record, workflowRunId, 'sourceWorkflowRunId'));
  }
  return false;
};

export const correlateHarnessRunArtifacts = async ({
  run,
  loadSessionAnalysis = async ({ sessionId }) => SessionAnalysis.findOne({ sessionId }).lean(),
  loadUserCoachingMemory = async ({ ownerUserId }) => UserCoachingMemory.findOne({ userId: ownerUserId }).lean(),
} = {}) => {
  const [sessionAnalysis, userCoachingMemory] = await Promise.all([
    loadSessionAnalysis({ sessionId: run.sessionId }),
    loadUserCoachingMemory({ ownerUserId: run.ownerUserId }),
  ]);
  const workflowRunId = run.workflowRunId;
  const memoryWrites = (run.memoryWrites || []).map((write) => ({
    ...write,
    status: hasMemoryWriteOutcome({
      write,
      workflowRunId,
      sessionAnalysis,
      userCoachingMemory,
    }) ? 'completed' : 'orphaned',
  }));
  const orphanedWrites = memoryWrites.filter((write) => write.status === 'orphaned');
  const correlationFailures = orphanedWrites.map((write) => buildFailureClassification({
    failureId: `failure:${workflowRunId}:orphaned:${write.memoryType}`,
    workflowRunId,
    subjectRef: write.memoryWriteId,
    occurredAt: new Date().toISOString(),
    stage: 'memory_write_correlation',
    category: 'memory_policy_failure',
    reasonCode: 'background_memory_write_orphaned',
    handled: true,
    expected: false,
    retryable: true,
    fallbackApplied: false,
    userImpact: 'none',
    memoryWriteRef: write.memoryWriteId,
  }));
  const failures = [...(run.failures || []), ...correlationFailures];

  return {
    ...run,
    qualityStatus: orphanedWrites.length ? 'invalid' : run.qualityStatus,
    memoryWrites,
    memoryWriteRefs: memoryWrites.map((write) => write.memoryWriteId),
    failures,
    failureRefs: failures.map((failure) => failure.failureId),
    correlation: {
      decisionRecordCount: (sessionAnalysis?.decisionRecords || [])
        .filter((record) => matchesRun(record, workflowRunId)).length,
      trajectoryRecordCount: (sessionAnalysis?.trajectoryRecords || [])
        .filter((record) => matchesRun(record, workflowRunId)).length,
      traceEventCount: (sessionAnalysis?.agentTraceEvents || [])
        .filter((record) => matchesRun(record, workflowRunId)).length,
    },
    timeline: [
      ...(run.timeline || []),
      {
        eventType: 'memory_write_correlated_or_orphaned',
        at: new Date().toISOString(),
        ref: workflowRunId,
        status: orphanedWrites.length ? 'orphaned' : 'completed',
        completedCount: memoryWrites.length - orphanedWrites.length,
        orphanedCount: orphanedWrites.length,
      },
    ],
  };
};
