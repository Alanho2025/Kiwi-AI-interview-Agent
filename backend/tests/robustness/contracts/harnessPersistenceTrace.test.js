import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendCanonicalRun: vi.fn(),
  correlateHarnessRunArtifacts: vi.fn(),
  emitHarnessRunTrace: vi.fn(),
  enqueueBackgroundJob: vi.fn(),
}));

vi.mock('../../../src/repositories/harnessWorkflowRunRepository.js', () => ({
  harnessWorkflowRunRepository: {
    appendCanonicalRun: mocks.appendCanonicalRun,
    finalizeCanonicalRun: vi.fn(),
  },
}));

vi.mock('../../../src/services/harness/harnessRunCorrelationService.js', () => ({
  correlateHarnessRunArtifacts: mocks.correlateHarnessRunArtifacts,
}));

vi.mock('../../../src/services/harness/harnessRunTraceService.js', () => ({
  emitHarnessRunTrace: mocks.emitHarnessRunTrace,
}));

vi.mock('../../../src/jobs/backgroundJobQueue.js', () => ({
  enqueueBackgroundJob: mocks.enqueueBackgroundJob,
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { error: vi.fn() },
}));

const { scheduleHarnessRunPersistence } = await import(
  '../../../src/services/harness/interviewNextTurnShadowHarness.js'
);

describe('M1 harness persistence trace stages', () => {
  it('emits the task trace before queued persistence and the final trace after correlation', async () => {
    const run = {
      workflowRunId: 'run-persistence-trace-1',
      sessionId: 'session-persistence-trace-1',
      ownerUserId: 'owner-persistence-trace-1',
      taskType: 'interview_next_turn',
      lifecycleStatus: 'completed',
      timeline: [],
    };
    const correlatedRun = {
      ...run,
      qualityStatus: 'invalid',
      memoryWrites: [{ memoryType: 'user_coaching_memory', status: 'orphaned' }],
    };
    mocks.correlateHarnessRunArtifacts.mockResolvedValue(correlatedRun);
    mocks.appendCanonicalRun.mockResolvedValue(correlatedRun);
    let queuedHandler = null;
    mocks.enqueueBackgroundJob.mockImplementation((_name, handler) => { queuedHandler = handler; });

    await scheduleHarnessRunPersistence(run);

    expect(mocks.emitHarnessRunTrace).toHaveBeenNthCalledWith(1, expect.objectContaining({
      run,
      traceStage: 'task_completed',
      persistenceStatus: 'queued',
    }));
    expect(queuedHandler).toEqual(expect.any(Function));

    await queuedHandler();

    expect(mocks.emitHarnessRunTrace).toHaveBeenNthCalledWith(2, expect.objectContaining({
      run: correlatedRun,
      traceStage: 'durable_persisted',
      persistenceStatus: 'persisted',
    }));
  });
});
