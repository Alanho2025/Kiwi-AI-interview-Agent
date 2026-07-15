import { describe, expect, it, vi } from 'vitest';

import {
  beginWaitingInterviewNextTurnRun,
  runInterviewNextTurnWithShadowHarness,
} from '../../../src/services/harness/interviewNextTurnShadowHarness.js';
import {
  buildM1ObservationFixture,
  buildM1SessionFixture,
  M1_LEGACY_RESULT,
} from '../../fixtures/harness/m1InterviewNextTurnFixtures.js';

describe('M1 interview_next_turn shadow harness', () => {
  it('returns the exact legacy result while recording one canonical run', async () => {
    const appendRun = vi.fn().mockResolvedValue(null);
    const executeController = vi.fn(async ({ observe }) => {
      observe(buildM1ObservationFixture());
      return M1_LEGACY_RESULT;
    });

    const result = await runInterviewNextTurnWithShadowHarness({
      enabled: true,
      session: buildM1SessionFixture(),
      payload: { inputMode: 'text', clientTurnId: 'text-turn-m1-001' },
      executeController,
      appendRun,
      now: () => new Date('2026-07-15T00:00:00.000Z'),
      workflowRunIdFactory: () => 'run-m1-001',
    });

    expect(result).toBe(M1_LEGACY_RESULT);
    expect(executeController).toHaveBeenCalledTimes(1);
    expect(appendRun).toHaveBeenCalledTimes(1);
    expect(appendRun).toHaveBeenCalledWith(expect.objectContaining({
      workflowRunId: 'run-m1-001',
      idempotencyKey: expect.any(String),
      resultRefs: expect.any(Array),
    }));
  });

  it('does no harness work when the feature flag is disabled', async () => {
    const appendRun = vi.fn();
    const executeController = vi.fn(async () => M1_LEGACY_RESULT);

    const result = await runInterviewNextTurnWithShadowHarness({
      enabled: false,
      session: buildM1SessionFixture(),
      payload: { inputMode: 'text', clientTurnId: 'text-turn-m1-off' },
      executeController,
      appendRun,
    });

    expect(result).toBe(M1_LEGACY_RESULT);
    expect(executeController).toHaveBeenCalledWith({ observe: expect.any(Function), workflowRunId: null });
    expect(appendRun).not.toHaveBeenCalled();
  });

  it('does not fail the interview when shadow persistence fails', async () => {
    const onRecordingFailure = vi.fn();
    const result = await runInterviewNextTurnWithShadowHarness({
      enabled: true,
      session: buildM1SessionFixture(),
      payload: { inputMode: 'text', clientTurnId: 'text-turn-persist-failure' },
      executeController: async ({ observe }) => {
        observe(buildM1ObservationFixture());
        return M1_LEGACY_RESULT;
      },
      appendRun: vi.fn().mockRejectedValue(new Error('mongo unavailable')),
      onRecordingFailure,
      workflowRunIdFactory: () => 'run-persist-failure',
    });

    expect(result).toBe(M1_LEGACY_RESULT);
    expect(onRecordingFailure).toHaveBeenCalledWith(expect.objectContaining({
      workflowRunId: 'run-persist-failure',
      reasonCode: 'shadow_persistence_failed',
      handled: true,
      userImpact: 'none',
    }));
  });

  it('uses one workflowRunId across voice waiting and confirmed resume', async () => {
    const appendRun = vi.fn().mockResolvedValue(null);
    const waiting = await beginWaitingInterviewNextTurnRun({
      enabled: true,
      session: { ...buildM1SessionFixture(), mode: 'voice' },
      payload: { inputMode: 'duplex_voice', clientTurnId: 'voice-turn-m1-001' },
      appendRun,
      workflowRunIdFactory: () => 'run-voice-waiting-001',
      now: () => new Date('2026-07-15T00:00:00.000Z'),
    });

    const result = await runInterviewNextTurnWithShadowHarness({
      enabled: true,
      session: { ...buildM1SessionFixture(), mode: 'voice' },
      payload: {
        inputMode: 'duplex_voice',
        clientTurnId: 'voice-turn-m1-002-confirmation',
        workflowRunId: waiting.workflowRunId,
      },
      executeController: async ({ observe, workflowRunId }) => {
        expect(workflowRunId).toBe('run-voice-waiting-001');
        observe(buildM1ObservationFixture());
        return M1_LEGACY_RESULT;
      },
      appendRun,
      workflowRunIdFactory: () => 'must-not-create-a-child-run',
    });

    expect(result).toBe(M1_LEGACY_RESULT);
    expect(waiting).toMatchObject({
      workflowRunId: 'run-voice-waiting-001',
      lifecycleStatus: 'waiting',
    });
    expect(appendRun).toHaveBeenCalledTimes(2);
    expect(appendRun.mock.calls[1][0]).toMatchObject({
      workflowRunId: 'run-voice-waiting-001',
      lifecycleStatus: 'completed',
    });
  });
});
