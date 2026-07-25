import { describe, expect, it, vi } from 'vitest';

import { queryOwnedHarnessRunTimelines } from '../../../src/services/harness/harnessRunQueryService.js';

describe('M1 developer harness run query', () => {
  it('returns the redacted contract timeline and enforces owner scope in the repository call', async () => {
    const repository = {
      findOwnedRuns: vi.fn().mockResolvedValue([{
        _id: 'mongo-private-id',
        workflowRunId: 'run-query-1',
        idempotencyKey: 'idem-query-1',
        taskType: 'interview_next_turn',
        executionMode: 'shadow',
        ownerUserId: 'owner-query-1',
        sessionId: 'session-query-1',
        channel: 'text',
        lifecycleStatus: 'completed',
        qualityStatus: 'valid',
        publicationStatus: 'not_applicable',
        contextPackets: [{ contextPacketId: 'context-query-1', sources: [] }],
        actionContracts: [{ selectedAction: 'ASK_PROBING_QUESTION' }],
        gateResults: [],
        memoryWrites: [],
        failures: [],
        resultRefs: ['session_question:session-query-1:2'],
        executionControls: {
          schemaVersion: 'harness_execution_controls_v1',
          preflight: {
            status: 'review',
            reasonCodes: ['numeric_budget_not_frozen'],
          },
          budgetLedger: {
            actualModelCalls: 2,
            actualInputTokens: 180,
            actualOutputTokens: 45,
            actualEstimatedCost: 0.003,
            budgetStatus: 'unavailable',
          },
          resultEnvelope: {
            validationStatus: 'valid',
            nextStep: { type: 'continue', ref: null },
          },
          capabilityCalls: [{
            capabilityId: 'interviewer',
            status: 'completed',
            durationMs: 250,
          }],
          writeGateDecisions: [],
        },
        timeline: [],
        privacy: { rawSnapshotAllowed: false },
        schemaVersion: 'workflow_run_v0',
      }]),
    };

    const timelines = await queryOwnedHarnessRunTimelines({
      ownerUserId: 'owner-query-1',
      sessionId: 'session-query-1',
      limit: 10,
      repository,
    });

    expect(repository.findOwnedRuns).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: 'owner-query-1',
      sessionId: 'session-query-1',
      limit: 10,
    }));
    expect(timelines).toEqual([
      expect.objectContaining({
        workflowRunId: 'run-query-1',
        contextPackets: [{ contextPacketId: 'context-query-1', sources: [] }],
        actionContracts: [{ selectedAction: 'ASK_PROBING_QUESTION' }],
        executionControls: expect.objectContaining({
          schemaVersion: 'harness_execution_controls_v1',
          budgetLedger: expect.objectContaining({
            actualModelCalls: 2,
            actualInputTokens: 180,
          }),
          capabilityCalls: [{
            capabilityId: 'interviewer',
            status: 'completed',
            durationMs: 250,
          }],
        }),
        privacy: { rawSnapshotAllowed: false },
      }),
    ]);
    expect(timelines[0]).not.toHaveProperty('_id');
  });
});
