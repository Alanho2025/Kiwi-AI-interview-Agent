import { describe, expect, it } from 'vitest';

import {
  buildHarnessIdempotencyKey,
  buildInterviewNextTurnWorkflowRun,
  validateHarnessWorkflowRun,
} from '../../../src/services/harness/harnessWorkflowRunContract.js';
import {
  buildM1ObservationFixture,
  buildM1SessionFixture,
  M1_LEGACY_RESULT,
  M1_SENSITIVE_ANSWER,
} from '../../fixtures/harness/m1InterviewNextTurnFixtures.js';

describe('M1 harness WorkflowRun contract', () => {
  it('builds the seven shared contract views without copying candidate content', () => {
    const session = buildM1SessionFixture();
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId: 'run-m1-001',
      session,
      payload: {
        answer: M1_SENSITIVE_ANSWER,
        inputMode: 'text',
        clientTurnId: 'text-turn-m1-001',
      },
      observation: buildM1ObservationFixture(),
      result: M1_LEGACY_RESULT,
      startedAt: '2026-07-15T00:00:00.000Z',
      completedAt: '2026-07-15T00:00:01.250Z',
    });

    expect(validateHarnessWorkflowRun(run)).toEqual({ valid: true, errors: [] });
    expect(run).toMatchObject({
      workflowRunId: 'run-m1-001',
      taskType: 'interview_next_turn',
      executionMode: 'shadow',
      ownerUserId: session.userId,
      sessionId: session.id,
      channel: 'text',
      lifecycleStatus: 'completed',
      qualityStatus: 'valid',
      publicationStatus: 'not_applicable',
      taskContract: { taskContractRef: 'interview_next_turn_v0' },
      privacy: {
        rawSnapshotAllowed: false,
        redactionPolicyVersion: 'harness_redaction_v0',
      },
    });
    expect(run.contextPackets).toHaveLength(1);
    expect(run.actionContracts).toHaveLength(1);
    expect(run.gateResults.map((gate) => gate.gateType)).toEqual(expect.arrayContaining([
      'action_allowed_candidate',
      'question_counting',
      'question_novelty',
      'transcript_eligibility',
      'memory_write_policy_shadow',
    ]));
    expect(run.memoryWrites).toEqual(expect.arrayContaining([
      expect.objectContaining({ memoryType: 'session_agent_memory', canAffectScoring: false }),
    ]));
    expect(JSON.stringify(run)).not.toContain(M1_SENSITIVE_ANSWER);
    expect(JSON.stringify(run)).not.toContain('private Kiwi billing migration');
    expect(JSON.stringify(run)).not.toContain('private candidate reason');
  });

  it('classifies invalid model output and preserves deterministic fallback lineage', () => {
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId: 'run-m1-invalid-action',
      session: buildM1SessionFixture(),
      payload: { inputMode: 'text', clientTurnId: 'text-turn-invalid-action' },
      observation: buildM1ObservationFixture({
        modelSelectionError: 'Model selected disallowed action: DELETE_SESSION',
      }),
      result: { ...M1_LEGACY_RESULT, selectionSource: 'rule_fallback' },
      startedAt: '2026-07-15T00:00:00.000Z',
      completedAt: '2026-07-15T00:00:01.000Z',
    });

    expect(run.actionContracts[0]).toMatchObject({
      selectedAction: 'ASK_DEEP_DIVE_QUESTION',
      fallbackAction: 'ASK_DEEP_DIVE_QUESTION',
      selectionSource: 'rule_fallback',
    });
    expect(run.failures).toContainEqual(expect.objectContaining({
      category: 'model_output',
      reasonCode: 'model_action_selection_failed',
      handled: true,
      retryable: false,
      fallbackApplied: true,
      userImpact: 'none',
    }));
  });

  it('derives a stable scoped idempotency key from the client turn', () => {
    const input = {
      taskType: 'interview_next_turn',
      sessionId: 'session-m1-shadow-001',
      clientTurnId: 'text-turn-m1-001',
    };

    expect(buildHarnessIdempotencyKey(input)).toBe(buildHarnessIdempotencyKey(input));
    expect(buildHarnessIdempotencyKey(input)).not.toBe(buildHarnessIdempotencyKey({
      ...input,
      clientTurnId: 'text-turn-m1-002',
    }));
  });

  it('returns explicit validation failures for an incomplete run', () => {
    const validation = validateHarnessWorkflowRun({ workflowRunId: 'incomplete' });

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      'taskType is required',
      'contextPackets must contain at least one item',
      'failureRefs must be an array',
    ]));
  });

  it('does not invent a memory write for an early terminal result', () => {
    const session = buildM1SessionFixture();
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId: 'run-m1-terminal',
      session,
      payload: { inputMode: 'text', clientTurnId: 'text-turn-terminal' },
      result: {
        isComplete: true,
        completedBecause: 'question_limit_reached',
        nextQuestion: null,
        nextQuestionOrder: session.currentQuestionIndex,
      },
    });

    expect(run.memoryWrites).toEqual([]);
    expect(run.memoryWriteRefs).toEqual([]);
    expect(run.resultRefs[0]).toContain('terminal_result');
    expect(validateHarnessWorkflowRun(run).valid).toBe(true);
  });
});
