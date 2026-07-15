import { describe, expect, it } from 'vitest';

import { correlateHarnessRunArtifacts } from '../../../src/services/harness/harnessRunCorrelationService.js';
import { buildInterviewNextTurnWorkflowRun } from '../../../src/services/harness/harnessWorkflowRunContract.js';
import {
  buildM1ObservationFixture,
  buildM1SessionFixture,
  M1_LEGACY_RESULT,
} from '../../fixtures/harness/m1InterviewNextTurnFixtures.js';

const buildRun = ({ withReflection = false } = {}) => {
  const observation = buildM1ObservationFixture();
  if (withReflection) observation.reflectionRecord = { reflectionId: 'reflection-1' };
  return buildInterviewNextTurnWorkflowRun({
    workflowRunId: 'run-correlation-1',
    session: buildM1SessionFixture(),
    payload: { inputMode: 'text', clientTurnId: 'turn-correlation-1' },
    observation,
    result: M1_LEGACY_RESULT,
  });
};

describe('M1 harness background artifact correlation', () => {
  it('marks actual decision, trajectory, trace, and memory outcomes on one run', async () => {
    const run = buildRun({ withReflection: true });
    const correlated = await correlateHarnessRunArtifacts({
      run,
      loadSessionAnalysis: async () => ({
        decisionRecords: [{ decisionId: 'decision-1', workflowRunId: run.workflowRunId }],
        trajectoryRecords: [{ trajectoryId: 'trajectory-1', workflowRunId: run.workflowRunId }],
        agentTraceEvents: [{ eventId: 'trace-1', workflowRunId: run.workflowRunId }],
        reflectionRecords: [{ reflectionId: 'reflection-1', sourceWorkflowRunId: run.workflowRunId }],
        agentMemory: { sourceWorkflowRunId: run.workflowRunId },
      }),
      loadUserCoachingMemory: async () => ({
        memoryRecords: [{ memoryId: 'reflection-1', sourceWorkflowRunId: run.workflowRunId }],
      }),
    });

    expect(correlated.correlation).toEqual({
      decisionRecordCount: 1,
      trajectoryRecordCount: 1,
      traceEventCount: 1,
    });
    expect(correlated.memoryWrites).toEqual(expect.arrayContaining([
      expect.objectContaining({ memoryType: 'session_agent_memory', status: 'completed' }),
      expect.objectContaining({ memoryType: 'session_reflection', status: 'completed' }),
      expect.objectContaining({ memoryType: 'user_coaching_memory', status: 'completed' }),
    ]));
    expect(correlated.failures).toHaveLength(0);
    expect(correlated.timeline).toContainEqual(expect.objectContaining({
      eventType: 'memory_write_correlated_or_orphaned',
      status: 'completed',
    }));
  });

  it('classifies an uncorrelated write instead of silently reporting success', async () => {
    const run = buildRun();
    const correlated = await correlateHarnessRunArtifacts({
      run,
      loadSessionAnalysis: async () => ({
        decisionRecords: [],
        trajectoryRecords: [],
        agentTraceEvents: [],
        reflectionRecords: [],
        agentMemory: {},
      }),
      loadUserCoachingMemory: async () => ({ memoryRecords: [] }),
    });

    expect(correlated.memoryWrites).toContainEqual(expect.objectContaining({
      memoryType: 'session_agent_memory',
      status: 'orphaned',
    }));
    expect(correlated.failures).toContainEqual(expect.objectContaining({
      category: 'correlation',
      reasonCode: 'background_memory_write_orphaned',
      handled: true,
      userImpact: 'none',
    }));
    expect(correlated.qualityStatus).toBe('invalid');
  });
});
