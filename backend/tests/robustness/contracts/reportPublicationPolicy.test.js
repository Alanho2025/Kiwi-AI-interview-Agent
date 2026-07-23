import { describe, expect, it } from 'vitest';

import { BLOCKING_REPORT_FLAGS } from '../../../src/services/agents/reportQaAgent.js';
import { buildReportPublicationDecision } from '../../../src/services/harness/reportPublicationPolicy.js';

describe('M4 report publication policy adapter', () => {
  it('marks a passed report ready without confusing execution and publication status', () => {
    const decision = buildReportPublicationDecision({
      workflowRunId: 'report-run-pass',
      executionMode: 'observe',
      qaResult: { passed: true, qualityFlags: [], consistencyChecks: [] },
      repairHistory: [],
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });

    expect(decision).toMatchObject({
      qualityStatus: 'passed',
      publicationStatus: 'ready',
      humanReviewRequired: false,
      gateResult: {
        status: 'pass',
        blockingScope: 'none',
        nextStep: { type: 'publish', ref: null },
      },
    });
  });

  it('maps critical QA flags to publication block and needs_review', () => {
    const decision = buildReportPublicationDecision({
      workflowRunId: 'report-run-block',
      executionMode: 'observe',
      qaResult: { passed: false, qualityFlags: ['alignment_claim_not_grounded'] },
      repairHistory: [],
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });

    expect(decision).toMatchObject({
      qualityStatus: 'blocked',
      publicationStatus: 'needs_review',
      humanReviewRequired: true,
      blockingFlags: ['alignment_claim_not_grounded'],
      gateResult: {
        status: 'block',
        blockingScope: 'publication',
        nextStep: { type: 'wait_for_review', ref: null },
        enforced: false,
      },
    });
  });

  it('maps every current critical QA flag to an observed publication block', () => {
    const falseNegatives = [...BLOCKING_REPORT_FLAGS].filter((flag) => {
      const decision = buildReportPublicationDecision({
        workflowRunId: `report-run-critical-${flag}`,
        executionMode: 'observe',
        qaResult: { passed: false, qualityFlags: [flag] },
        evaluatedAt: '2026-07-15T12:00:00.000Z',
      });
      return decision.gateResult.status !== 'block'
        || decision.publicationStatus !== 'needs_review';
    });

    expect(falseNegatives).toEqual([]);
  });

  it('keeps an unsupported noncritical claim out of ready publication', () => {
    const decision = buildReportPublicationDecision({
      workflowRunId: 'report-run-unsupported-claim',
      executionMode: 'observe',
      qaResult: { passed: false, qualityFlags: ['unsupported_high_confidence_feedback'] },
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });

    expect(decision).toMatchObject({
      qualityStatus: 'needs_review',
      publicationStatus: 'needs_review',
      humanReviewRequired: true,
      gateResult: {
        status: 'review',
        nextStep: { type: 'wait_for_review', ref: null },
      },
    });
  });

  it('records each existing repair attempt as an explicit repair action lineage', () => {
    const decision = buildReportPublicationDecision({
      workflowRunId: 'report-run-repaired',
      executionMode: 'observe',
      qaResult: { passed: true, qualityFlags: [] },
      repairHistory: [{ attempt: 1, status: 'repaired' }],
      evaluatedAt: '2026-07-15T12:00:00.000Z',
    });

    expect(decision).toMatchObject({
      qualityStatus: 'passed',
      publicationStatus: 'ready_after_repair',
      repairLineage: {
        attemptCount: 1,
        legacyInlineRepairObserved: true,
        explicitRepairActionCount: 1,
        explicitRepairActionsComplete: true,
        explicitRepairLineageComplete: true,
        explicitChildRunsComplete: false,
      },
    });
  });
});
