import { describe, expect, it, vi } from 'vitest';

import {
  buildReportWorkflowRun,
  runReportTaskWithHarness,
} from '../../../src/services/harness/reportWorkflowHarness.js';

const session = {
  id: 'session-report-harness-1',
  userId: 'user-report-harness-1',
  mode: 'text',
  cvFileId: 'cv-report-1',
  jdFingerprint: 'jd-report-1',
  transcript: [{ role: 'user', text: 'private candidate report evidence' }],
  interviewPlan: { schemaVersion: 'plan-v2', strategy: { matchAnalysisId: 'match-report-1' } },
};

describe('M4 report workflow harness', () => {
  it('returns the exact report result and records refs-only publication diagnostics', async () => {
    const productResult = {
      report: { sessionId: session.id, summary: 'private generated report summary' },
      qaResult: { passed: false, qualityFlags: ['alignment_claim_not_grounded'] },
      repairHistory: [],
      stored: { latestStatus: 'needs_review' },
      controllerAction: 'GENERATE_REPORT_DRAFT',
    };
    const appendRun = vi.fn().mockResolvedValue(null);

    const result = await runReportTaskWithHarness({
      enabled: true,
      executionMode: 'observe',
      taskType: 'generate_report',
      session,
      executeController: vi.fn().mockResolvedValue(productResult),
      appendRun,
      workflowRunIdFactory: () => 'report-run-observe-1',
      now: (() => {
        const values = ['2026-07-15T12:00:00.000Z', '2026-07-15T12:00:02.000Z'];
        let index = 0;
        return () => new Date(values[index++]);
      })(),
    });

    expect(result).toBe(productResult);
    expect(appendRun).toHaveBeenCalledWith(expect.objectContaining({
      workflowRunId: 'report-run-observe-1',
      taskType: 'generate_report',
      lifecycleStatus: 'completed',
      qualityStatus: 'blocked',
      publicationStatus: 'needs_review',
      taskContract: expect.objectContaining({
        schemaVersion: 'task_contract_v1',
        allowedCapabilityRefs: [
          'capability:retrieval:v1',
          'capability:reportGenerator:v1',
          'capability:reportQa:v1',
        ],
      }),
      executionControls: expect.objectContaining({
        preflight: expect.objectContaining({
          status: 'review',
          controllerAction: 'continue_observe',
        }),
        budgetLedger: expect.objectContaining({
          budgetStatus: 'unavailable',
        }),
        resultEnvelope: expect.objectContaining({
          publicationStatus: 'needs_review',
          validationStatus: 'partial',
          nextStep: { type: 'wait_for_review', ref: null },
        }),
        writeGateDecisions: [
          expect.objectContaining({
            decisionType: 'report_write',
            decision: 'review',
            enforced: false,
            sideEffectStatus: 'completed_before_observe_gate',
          }),
        ],
      }),
      gateResults: [expect.objectContaining({
        gateType: 'report_publication_allowed',
        status: 'block',
        blockingScope: 'publication',
        enforced: false,
      })],
      failures: [expect.objectContaining({
        category: 'verification_failure',
        userImpact: 'publication_blocked',
      })],
    }));
    const serializedRun = JSON.stringify(appendRun.mock.calls[0][0]);
    expect(serializedRun).not.toContain('private candidate report evidence');
    expect(serializedRun).not.toContain('private generated report summary');
    expect(appendRun.mock.calls[0][0].actionContracts[0].selectedAction)
      .toBe('GENERATE_REPORT_DRAFT');
  });

  it('normalizes persisted report dates in result refs', () => {
    const run = buildReportWorkflowRun({
      workflowRunId: 'report-run-date-ref',
      taskType: 'generate_report',
      session,
      result: {
        stored: { updatedAt: new Date('2026-07-15T10:00:00.000Z') },
      },
      startedAt: '2026-07-15T09:59:59.000Z',
      completedAt: '2026-07-15T10:00:00.000Z',
    });

    expect(run.resultRefs).toEqual([
      `session_report:${session.id}:2026-07-15T10:00:00.000Z`,
    ]);
    expect(run.actionContracts[0].selectedAction).toBe('GENERATE_REPORT_DRAFT');
  });

  it('maps repair history to explicit refs-only actions, gates, and timeline events', () => {
    const run = buildReportWorkflowRun({
      workflowRunId: 'report-run-repair-lineage',
      executionMode: 'observe',
      taskType: 'generate_report',
      session,
      result: {
        report: { summary: 'private repaired report summary' },
        qaResult: { passed: true, qualityFlags: [] },
        repairHistory: [{
          attempt: 1,
          status: 'repair_failed',
          repairInstruction: 'private first repair prompt must not be copied',
          qaBefore: {
            passed: false,
            qualityFlags: ['missing_actionable_coaching', 'candidate said private fact'],
            privateDetail: 'private QA payload must not be copied',
          },
          qaAfter: { passed: false, qualityFlags: ['missing_actionable_coaching'] },
          startedAt: '2026-07-15T10:00:00.000Z',
          completedAt: '2026-07-15T10:00:00.500Z',
        }, {
          attempt: 2,
          status: 'repaired',
          repairInstruction: 'private second repair prompt must not be copied',
          qaBefore: { passed: false, qualityFlags: ['missing_actionable_coaching'] },
          qaAfter: { passed: true, qualityFlags: [] },
          startedAt: '2026-07-15T10:00:00.600Z',
          completedAt: '2026-07-15T10:00:01.000Z',
        }],
        stored: { latestStatus: 'ready_after_repair' },
      },
      startedAt: '2026-07-15T09:59:59.000Z',
      completedAt: '2026-07-15T10:00:02.000Z',
    });

    expect(run.actionContracts).toHaveLength(3);
    expect(run.actionContracts[0].repairLineage).toMatchObject({
      explicitRepairActionCount: 2,
      explicitRepairActionsComplete: true,
      explicitRepairLineageComplete: true,
    });
    expect(run.actionContracts[1]).toMatchObject({
      actionType: 'REPAIR_REPORT_DRAFT',
      parentActionContractRef: 'action_contract:report-run-repair-lineage',
      repairAttempt: 1,
      repairInstructionPresent: true,
      qaBeforeFlagCodes: ['missing_actionable_coaching'],
      qaAfterFlagCodes: ['missing_actionable_coaching'],
      executionStatus: 'failed',
    });
    expect(run.actionContracts[2]).toMatchObject({
      actionType: 'REPAIR_REPORT_DRAFT',
      parentActionContractRef: 'action_contract:report-run-repair-lineage',
      repairAttempt: 2,
      repairInstructionPresent: true,
      qaAfterFlagCodes: [],
      executionStatus: 'completed',
    });
    expect(run.gateResults).toEqual(expect.arrayContaining([
      expect.objectContaining({
        gateType: 'report_repair_attempt_verified',
        status: 'pass',
        enforced: false,
      }),
      expect.objectContaining({
        gateType: 'report_repair_attempt_verified',
        status: 'review',
        enforced: false,
      }),
      expect.objectContaining({
        gateType: 'report_publication_allowed',
        status: 'pass',
        enforced: false,
      }),
    ]));
    expect(run.timeline.map((event) => event.eventType)).toEqual(expect.arrayContaining([
      'report_repair_action_started',
      'report_repair_action_failed',
      'report_repair_action_completed',
      'report_publication_gate_evaluated',
    ]));
    expect(run.failures).toEqual(expect.arrayContaining([
      expect.objectContaining({
        category: 'verification_failure',
        reasonCode: 'report_repair_failed_post_qa',
        handled: true,
        retryable: true,
        fallbackApplied: true,
        fallbackRef: 'action_contract:report-run-repair-lineage:report_repair:2',
      }),
    ]));
    const serializedRun = JSON.stringify(run);
    expect(serializedRun).not.toContain('private first repair prompt must not be copied');
    expect(serializedRun).not.toContain('private second repair prompt must not be copied');
    expect(serializedRun).not.toContain('private QA payload must not be copied');
    expect(serializedRun).not.toContain('private repaired report summary');
    expect(serializedRun).not.toContain('candidate said private fact');
  });

  it('does no harness work when disabled', async () => {
    const productResult = { qaResult: { passed: true } };
    const appendRun = vi.fn();
    const result = await runReportTaskWithHarness({
      enabled: false,
      taskType: 'qa_report',
      session,
      executeController: vi.fn().mockResolvedValue(productResult),
      appendRun,
    });

    expect(result).toBe(productResult);
    expect(appendRun).not.toHaveBeenCalled();
  });

  it('records actual fixed-registry capability calls without payloads', async () => {
    const appendRun = vi.fn().mockResolvedValue(null);
    const capabilityRegistry = {
      retrieval: vi.fn().mockResolvedValue({ privateEvidence: 'private retrieval result' }),
      reportGenerator: vi.fn().mockResolvedValue({ privateReport: 'private report result' }),
      reportQa: vi.fn().mockResolvedValue({ passed: true }),
    };
    let tick = 0;

    await runReportTaskWithHarness({
      enabled: true,
      executionMode: 'observe',
      taskType: 'generate_report',
      session,
      capabilityRegistry,
      executeController: async ({ capabilityRegistry: observedRegistry }) => {
        await observedRegistry.retrieval({ query: 'private candidate query' });
        await observedRegistry.reportGenerator({ transcript: 'private candidate transcript' });
        await observedRegistry.reportQa({ report: 'private candidate report' });
        return {
          report: { summary: 'private generated report summary' },
          qaResult: { passed: true, qualityFlags: [] },
          stored: { latestStatus: 'ready' },
        };
      },
      appendRun,
      workflowRunIdFactory: () => 'report-run-capability-observation',
      now: () => new Date(Date.parse('2026-07-26T00:00:00.000Z') + (tick++ * 100)),
    });

    const run = appendRun.mock.calls[0][0];
    expect(run.executionControls.capabilityCalls).toHaveLength(6);
    expect(run.executionControls.capabilityCalls.map((event) => event.eventType))
      .toEqual([
        'capability_call_started',
        'capability_call_completed',
        'capability_call_started',
        'capability_call_completed',
        'capability_call_started',
        'capability_call_completed',
      ]);
    expect(JSON.stringify(run.executionControls.capabilityCalls))
      .not.toMatch(/private candidate|private retrieval result|private report result/);
  });
});
