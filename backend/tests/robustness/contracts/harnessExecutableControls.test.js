import { describe, expect, it } from 'vitest';

import {
  buildHarnessExecutionControlContext,
  buildObservedWriteGateDecisions,
  completeHarnessExecutionControls,
  createObservedCapabilityRegistry,
  listHarnessCapabilityPolicies,
  validateHarnessExecutionControls,
} from '../../../src/services/harness/harnessExecutableControls.js';

const session = {
  id: 'session-m6-controls',
  userId: 'user-m6-controls',
  mode: 'text',
};

describe('M6 executable harness controls', () => {
  it('exposes metadata for the five fixed controller-owned capabilities', () => {
    const policies = listHarnessCapabilityPolicies();

    expect(policies).toHaveLength(5);
    expect(policies.map((policy) => policy.capabilityId)).toEqual([
      'retrieval',
      'interviewer',
      'reportGenerator',
      'reportQa',
      'interviewEvaluator',
    ]);
    expect(policies).toEqual(expect.arrayContaining([
      expect.objectContaining({
        capabilityId: 'interviewer',
        version: expect.any(String),
        allowedTaskTypes: ['interview_next_turn'],
        acceptedDataClasses: expect.arrayContaining(['private_candidate_data']),
        sideEffectClass: 'external_provider',
        timeoutMs: expect.any(Number),
        retryPolicy: expect.any(Object),
        fallbackPolicy: expect.any(Object),
        redactionPolicyVersion: expect.any(String),
      }),
    ]));
  });

  it('evaluates task, owner, capability, and budget availability before controller execution', () => {
    const context = buildHarnessExecutionControlContext({
      workflowRunId: 'run-m6-preflight',
      taskType: 'interview_next_turn',
      session,
      executionMode: 'observe',
      evaluatedAt: '2026-07-26T00:00:00.000Z',
    });

    expect(context.taskContract).toMatchObject({
      schemaVersion: 'task_contract_v1',
      contractVersion: 'v1',
      allowedCapabilityRefs: [
        'capability:retrieval:v1',
        'capability:interviewer:v1',
        'capability:interviewEvaluator:v1',
      ],
      budgetPolicyRef: 'budget_policy:interview_next_turn:observe_v1',
    });
    expect(context.preflight).toMatchObject({
      executionMode: 'observe',
      status: 'review',
      controllerAction: 'continue_observe',
      wouldBlockInEnforce: false,
      reasonCodes: ['numeric_budget_not_frozen'],
    });
    expect(context.preflight.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ checkType: 'task_contract', status: 'pass' }),
      expect.objectContaining({ checkType: 'owner_scope', status: 'pass' }),
      expect.objectContaining({ checkType: 'capability_scope', status: 'pass' }),
      expect.objectContaining({ checkType: 'budget_policy', status: 'review' }),
    ]));
  });

  it('records a disallowed capability as an enforce candidate without blocking observe mode', () => {
    const context = buildHarnessExecutionControlContext({
      workflowRunId: 'run-m6-disallowed-capability',
      taskType: 'qa_report',
      session,
      executionMode: 'observe',
      requestedCapabilityIds: ['interviewer'],
      evaluatedAt: '2026-07-26T00:00:00.000Z',
    });

    expect(context.preflight).toMatchObject({
      status: 'block',
      controllerAction: 'continue_observe',
      wouldBlockInEnforce: true,
    });
    expect(context.preflight.reasonCodes).toContain('capability_not_allowed_for_task');
  });

  it('keeps unavailable usage explicit and separates completion from result validity', () => {
    const context = buildHarnessExecutionControlContext({
      workflowRunId: 'run-m6-result',
      taskType: 'generate_report',
      session,
      executionMode: 'shadow',
      evaluatedAt: '2026-07-26T00:00:00.000Z',
    });
    const controls = completeHarnessExecutionControls({
      context,
      completedAt: '2026-07-26T00:00:02.000Z',
      lifecycleStatus: 'completed',
      qualityStatus: 'blocked',
      publicationStatus: 'needs_review',
      domainResultRef: 'session_report:session-m6-controls:v7',
    });

    expect(controls.budgetLedger).toMatchObject({
      budgetStatus: 'unavailable',
      actualModelCalls: null,
      actualInputTokens: null,
      actualOutputTokens: null,
      actualEstimatedCost: null,
      elapsedMs: 2000,
      stopReason: 'usage_not_correlated',
    });
    expect(controls.resultEnvelope).toMatchObject({
      domainResultRef: 'session_report:session-m6-controls:v7',
      lifecycleStatus: 'completed',
      qualityStatus: 'blocked',
      publicationStatus: 'needs_review',
      validationStatus: 'partial',
      stopReason: 'publication_review_required',
      nextStep: { type: 'wait_for_review' },
    });
    expect(controls.resultEnvelope.unknowns).toContain('actual_usage');
    expect(validateHarnessExecutionControls(controls)).toEqual({ valid: true, errors: [] });
  });

  it('does not copy candidate payload into control evidence', () => {
    const context = buildHarnessExecutionControlContext({
      workflowRunId: 'run-m6-private-data',
      taskType: 'interview_next_turn',
      session,
      executionMode: 'observe',
      evaluatedAt: '2026-07-26T00:00:00.000Z',
    });
    const controls = completeHarnessExecutionControls({
      context,
      completedAt: '2026-07-26T00:00:01.000Z',
      lifecycleStatus: 'completed',
      qualityStatus: 'valid',
      publicationStatus: 'not_applicable',
      domainResultRef: 'session_question:session-m6-controls:2',
      result: {
        answer: 'private candidate answer',
        prompt: 'private internal prompt',
      },
    });

    const serialized = JSON.stringify(controls);
    expect(serialized).not.toContain('private candidate answer');
    expect(serialized).not.toContain('private internal prompt');
  });

  it('observes capability lifecycle without recording inputs or outputs', async () => {
    const capability = async ({ privateAnswer }) => ({
      privateResult: `result for ${privateAnswer}`,
    });
    const observation = createObservedCapabilityRegistry({
      registry: { interviewer: capability },
      now: (() => {
        const values = [
          '2026-07-26T00:00:00.000Z',
          '2026-07-26T00:00:00.250Z',
        ];
        let index = 0;
        return () => new Date(values[index++]);
      })(),
    });

    await expect(observation.registry.interviewer({
      privateAnswer: 'private candidate answer',
    })).resolves.toEqual({
      privateResult: 'result for private candidate answer',
    });
    expect(observation.events).toEqual([
      expect.objectContaining({
        eventType: 'capability_call_started',
        capabilityId: 'interviewer',
        status: 'started',
      }),
      expect.objectContaining({
        eventType: 'capability_call_completed',
        capabilityId: 'interviewer',
        status: 'completed',
        durationMs: 250,
      }),
    ]);
    const serialized = JSON.stringify(observation.events);
    expect(serialized).not.toContain('private candidate answer');
    expect(serialized).not.toContain('privateResult');
  });

  it('correlates task and capability usage without copying provider metadata', async () => {
    let activeContext = {};
    const withUsageContext = async (context, execute) => {
      const previousContext = activeContext;
      activeContext = { ...activeContext, ...context };
      try {
        return await execute();
      } finally {
        activeContext = previousContext;
      }
    };
    const observation = createObservedCapabilityRegistry({
      workflowRunId: 'run-m6-usage',
      registry: {
        interviewer: async () => {
          activeContext.harnessUsageCollector({
            provider: 'deepseek',
            model: 'deepseek-chat',
            promptTokens: 120,
            completionTokens: 30,
            estimatedCost: 0.0012,
          });
          return { nextQuestion: 'Safe result' };
        },
      },
      withUsageContext,
    });

    await withUsageContext({
      harnessUsageCollector: observation.recordUsage,
    }, () => observation.registry.interviewer());

    expect(observation.usageEvents).toEqual([{
      provider: 'deepseek',
      model: 'deepseek-chat',
      capabilityId: 'interviewer',
      promptTokens: 120,
      completionTokens: 30,
      estimatedCost: 0.0012,
    }]);
    expect(JSON.stringify(observation.usageEvents)).not.toContain('metadata');
  });

  it('aggregates correlated model usage into the budget ledger', () => {
    const context = buildHarnessExecutionControlContext({
      workflowRunId: 'run-m6-measured-budget',
      taskType: 'interview_next_turn',
      session,
      executionMode: 'observe',
      evaluatedAt: '2026-07-26T00:00:00.000Z',
    });
    const controls = completeHarnessExecutionControls({
      context,
      completedAt: '2026-07-26T00:00:02.000Z',
      lifecycleStatus: 'completed',
      qualityStatus: 'valid',
      publicationStatus: 'not_applicable',
      usageEvents: [
        {
          provider: 'deepseek',
          model: 'deepseek-chat',
          capabilityId: null,
          promptTokens: 100,
          completionTokens: 20,
          estimatedCost: 0.001,
        },
        {
          provider: 'deepseek',
          model: 'deepseek-chat',
          capabilityId: 'interviewer',
          promptTokens: 80,
          completionTokens: 25,
          estimatedCost: 0.002,
        },
      ],
    });

    expect(controls.budgetLedger).toMatchObject({
      actualModelCalls: 2,
      actualInputTokens: 180,
      actualOutputTokens: 45,
      actualEstimatedCost: 0.003,
      budgetStatus: 'unavailable',
      stopReason: 'numeric_budget_not_frozen',
    });
    expect(controls.resultEnvelope.unknowns).not.toContain('actual_usage');
    expect(controls.resultEnvelope.warnings).toContain('numeric_budget_not_frozen');
  });

  it('does not convert a missing usage measurement into zero', () => {
    const context = buildHarnessExecutionControlContext({
      workflowRunId: 'run-m6-partial-usage',
      taskType: 'qa_report',
      session,
      executionMode: 'observe',
      evaluatedAt: '2026-07-26T00:00:00.000Z',
    });
    const controls = completeHarnessExecutionControls({
      context,
      completedAt: '2026-07-26T00:00:01.000Z',
      lifecycleStatus: 'completed',
      qualityStatus: 'valid',
      publicationStatus: 'ready',
      usageEvents: [{
        provider: 'deepseek',
        model: 'deepseek-chat',
        capabilityId: 'reportQa',
        promptTokens: 50,
        completionTokens: 10,
        estimatedCost: null,
      }],
    });

    expect(controls.budgetLedger.actualEstimatedCost).toBeNull();
    expect(controls.resultEnvelope.unknowns).toContain('actual_estimated_cost');
  });

  it('records report and cross-session memory write decisions without pretending they were enforced', () => {
    const decisions = buildObservedWriteGateDecisions({
      workflowRunId: 'run-m6-write-gates',
      taskType: 'generate_report',
      ownerUserId: 'user-m6-controls',
      sessionId: 'session-m6-controls',
      publicationStatus: 'needs_review',
      memoryWrites: [{
        memoryWriteId: 'memory_write:run-m6-write-gates:user_coaching',
        scope: 'user_coaching',
        sourceEvidenceRefs: ['evidence:answer:1'],
        policyVersion: 'interview_memory_write_v0',
      }],
      evaluatedAt: '2026-07-26T00:00:02.000Z',
    });

    expect(decisions).toEqual([
      expect.objectContaining({
        decisionType: 'report_write',
        decision: 'review',
        enforced: false,
        sideEffectStatus: 'completed_before_observe_gate',
        targetRef: 'session_report:session-m6-controls',
      }),
      expect.objectContaining({
        decisionType: 'memory_write',
        decision: 'defer',
        enforced: false,
        targetRef: 'memory_write:run-m6-write-gates:user_coaching',
      }),
    ]);
  });
});
