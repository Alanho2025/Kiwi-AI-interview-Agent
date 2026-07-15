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
    expect(run.actionContracts[0]).toMatchObject({
      schemaVersion: 'action_contract_v0',
      workflowRunId: 'run-m1-001',
      actionType: 'ASK_DEEP_DIVE_QUESTION',
      idempotency: { required: true, scope: 'client_turn' },
      fallbackPolicy: { fallbackActionType: 'ASK_DEEP_DIVE_QUESTION', failClosed: false },
    });
    expect(run.gateResults.map((gate) => gate.gateType)).toEqual(expect.arrayContaining([
      'action_allowed_candidate',
      'question_counting',
      'question_novelty',
      'transcript_eligibility',
      'memory_write_policy_shadow',
    ]));
    expect(run.gateResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        schemaVersion: 'gate_result_v0',
        workflowRunId: 'run-m1-001',
        gatePolicyVersion: 'interview_observed_gates_v0',
        executionMode: 'shadow',
        blockingScope: expect.any(String),
        reasonCodes: expect.any(Array),
        nextStep: expect.objectContaining({ type: expect.any(String) }),
      }),
    ]));
    expect(run.memoryWrites).toEqual(expect.arrayContaining([
      expect.objectContaining({
        schemaVersion: 'memory_write_v0',
        memoryType: 'session_agent_memory',
        scope: 'session',
        sourceWorkflowRunId: 'run-m1-001',
        canAffectScoring: false,
        policy: expect.objectContaining({ canAffectScoring: false }),
      }),
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
      schemaVersion: 'failure_classification_v0',
      workflowRunId: 'run-m1-invalid-action',
      category: 'model_output_failure',
      reasonCode: 'model_action_selection_failed',
      handled: true,
      expected: true,
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

  it('treats correctly rejected duplicate candidates as a passing novelty gate', () => {
    const observation = buildM1ObservationFixture();
    observation.interviewerOutput.questionDecision.rejectedCandidates = [
      { questionId: 'duplicate-question', reason: 'duplicate_fingerprint' },
    ];
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId: 'run-m2-duplicate-rejected',
      executionMode: 'observe',
      session: buildM1SessionFixture(),
      payload: { inputMode: 'text', clientTurnId: 'turn-m2-duplicate-rejected' },
      observation,
      result: M1_LEGACY_RESULT,
    });

    expect(run.executionMode).toBe('observe');
    expect(run.gateResults.find((gate) => gate.gateType === 'question_novelty')).toMatchObject({
      status: 'pass',
      executionMode: 'observe',
      reasonCodes: ['duplicate_candidates_rejected'],
      blockingScope: 'none',
    });
  });

  it('records voice confirmation as a review gate that blocks scoring and waits on the same run', () => {
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId: 'run-m2-voice-waiting',
      executionMode: 'observe',
      session: { ...buildM1SessionFixture(), mode: 'voice' },
      payload: { inputMode: 'duplex_voice', clientTurnId: 'turn-m2-voice-waiting' },
      lifecycleStatus: 'waiting',
    });

    expect(run.gateResults.find((gate) => gate.gateType === 'transcript_eligibility')).toMatchObject({
      status: 'review',
      blockingScope: 'scoring',
      reasonCodes: ['voice_transcript_confirmation_pending'],
      nextStep: { type: 'wait_for_review', ref: 'run-m2-voice-waiting' },
    });
  });

  it('warns when a non-question repair turn advances the question count', () => {
    const observation = buildM1ObservationFixture();
    observation.interviewerOutput.turnKind = 'repair';
    observation.interviewerOutput.questionType = 'clarification';
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId: 'run-m2-repair-miscount',
      executionMode: 'observe',
      session: buildM1SessionFixture(),
      payload: { inputMode: 'text', clientTurnId: 'turn-m2-repair-miscount' },
      observation,
      result: M1_LEGACY_RESULT,
    });

    expect(run.gateResults.find((gate) => gate.gateType === 'question_counting')).toMatchObject({
      status: 'warn',
      blockingScope: 'task',
      reasonCodes: ['non_interview_turn_advanced_question_count'],
    });
  });

  it('records a refs-only user interview memory read and its non-scoring policy decision', () => {
    const observation = buildM1ObservationFixture();
    observation.decisionContext.userInterviewMemory = {
      schemaVersion: 'user_interview_memory_projection_v0',
      policyVersion: 'user_interview_memory_v0',
      generatedAt: '2026-07-15T00:00:00.000Z',
    };
    observation.plan.selectionSource = 'user_interview_memory_policy';
    observation.plan.memoryPolicyDecision = {
      reasonCode: 'routine_repeat_suppressed_for_coverage_gap',
      competencyKey: 'system_design',
      independentSessionCount: 2,
      canAffectScoring: false,
    };
    const run = buildInterviewNextTurnWorkflowRun({
      workflowRunId: 'run-m3-memory-read',
      executionMode: 'observe',
      session: buildM1SessionFixture(),
      payload: { inputMode: 'text', clientTurnId: 'turn-m3-memory-read' },
      observation,
      result: M1_LEGACY_RESULT,
    });

    expect(run.contextPackets[0].sources).toContainEqual(expect.objectContaining({
      sourceType: 'user_interview_memory',
      sourceRef: 'session_memory_projection:session-m1-shadow-001',
      trustLevel: 'system_derived',
    }));
    expect(run.actionContracts[0].memoryPolicyDecision).toMatchObject({
      reasonCode: 'routine_repeat_suppressed_for_coverage_gap',
      independentSessionCount: 2,
      canAffectScoring: false,
    });
  });
});
