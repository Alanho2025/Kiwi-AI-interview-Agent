import { describe, expect, it, vi } from 'vitest';

import {
  buildHarnessRunTrace,
  emitHarnessRunTrace,
} from '../../../src/services/harness/harnessRunTraceService.js';

const buildRun = () => ({
  workflowRunId: 'run-trace-1',
  ownerUserId: 'private-owner-id',
  sessionId: 'session-trace-1',
  clientTurnId: 'voice-turn-1-1',
  taskType: 'interview_next_turn',
  channel: 'voice',
  lifecycleStatus: 'completed',
  qualityStatus: 'valid',
  actionContracts: [{
    selectedAction: 'ASK_VALIDATION_QUESTION',
    fallbackAction: 'ASK_PROBING_QUESTION',
    selectionSource: 'voice_single_blocking_llm_rule_lane',
  }],
  gateResults: [{
    gateType: 'question_novelty',
    status: 'warn',
    reasonCode: 'duplicate_candidates_rejected',
  }],
  memoryWrites: [{
    memoryType: 'user_coaching_memory',
    status: 'scheduled',
    canAffectScoring: false,
  }],
  failures: [],
  timeline: [
    { eventType: 'workflow_run_started', at: '2026-07-15T00:00:00.000Z' },
    { eventType: 'workflow_run_completed', at: '2026-07-15T00:00:04.000Z' },
  ],
  contextPackets: [{ rawPrivateSnapshot: 'private candidate transcript' }],
  resultRefs: [
    'session_question:session-trace-1:2',
    { privateResult: 'private generated question' },
  ],
  correlation: {
    decisionRecordCount: 4,
    trajectoryRecordCount: 1,
    traceEventCount: 3,
    privatePayload: 'private correlation content',
  },
  latency: { controllerMs: 4000 },
});

describe('M1 harness backend trace', () => {
  it('builds a compact redacted trace without owner or context payloads', () => {
    const trace = buildHarnessRunTrace({
      run: buildRun(),
      traceStage: 'task_completed',
      persistenceStatus: 'queued',
      correlationStatus: 'pending',
    });

    expect(trace).toEqual(expect.objectContaining({
      traceVersion: 'harness_run_trace_v0',
      traceStage: 'task_completed',
      persistenceStatus: 'queued',
      workflowRunId: 'run-trace-1',
      sessionId: 'session-trace-1',
      selectedAction: 'ASK_VALIDATION_QUESTION',
      controllerMs: 4000,
      gates: [{
        gateType: 'question_novelty',
        status: 'warn',
        reasonCode: 'duplicate_candidates_rejected',
      }],
      memoryWrites: [{
        memoryType: 'user_coaching_memory',
        status: 'scheduled',
        canAffectScoring: false,
      }],
      timeline: ['workflow_run_started', 'workflow_run_completed'],
      resultRefs: ['session_question:session-trace-1:2'],
      correlation: {
        decisionRecordCount: 4,
        trajectoryRecordCount: 1,
        traceEventCount: 3,
      },
    }));
    expect(JSON.stringify(trace)).not.toContain('private-owner-id');
    expect(JSON.stringify(trace)).not.toContain('private candidate transcript');
    expect(JSON.stringify(trace)).not.toContain('private generated question');
    expect(JSON.stringify(trace)).not.toContain('private correlation content');
  });

  it('writes one filterable structured backend trace event', () => {
    const logInfo = vi.fn();

    emitHarnessRunTrace({
      run: buildRun(),
      traceStage: 'task_completed',
      persistenceStatus: 'queued',
      logInfo,
    });

    expect(logInfo).toHaveBeenCalledWith(
      'Harness workflow trace',
      expect.objectContaining({
        workflowRunId: 'run-trace-1',
        traceStage: 'task_completed',
        persistenceStatus: 'queued',
      }),
    );
  });

  it('does not report zero correlation counts before correlation has run', () => {
    const run = buildRun();
    delete run.correlation;

    const trace = buildHarnessRunTrace({
      run,
      traceStage: 'task_completed',
      persistenceStatus: 'queued',
    });

    expect(trace.correlationStatus).toBe('pending');
    expect(trace.correlation).toBeNull();
  });
});
