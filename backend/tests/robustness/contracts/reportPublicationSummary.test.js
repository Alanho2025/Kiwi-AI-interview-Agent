import { describe, expect, it } from 'vitest';

import { buildCandidateReportPublicationSummary } from '../../../src/services/report/reportPublicationSummaryService.js';

describe('candidate-safe report publication summary', () => {
  it.each([
    ['ready', 'verified', 'Report checks complete', null],
    ['ready_after_repair', 'verified_after_repair', 'Report checks complete after repair', null],
    ['needs_review', 'needs_review', 'This report still needs review', 'recheck_report'],
    ['repair_failed', 'verification_incomplete', 'Report verification is incomplete', 'recheck_report'],
  ])('maps %s to a candidate-safe outcome', (latestStatus, status, title, nextActionType) => {
    const summary = buildCandidateReportPublicationSummary({
      latestStatus,
      qaResult: {
        qualityFlags: ['private_internal_flag'],
        internalReasoning: 'private chain-of-thought',
      },
    });

    expect(summary).toMatchObject({
      schemaVersion: 'report_publication_summary_v1',
      status,
      title,
    });
    expect(summary.nextAction?.type || null).toBe(nextActionType);
    expect(JSON.stringify(summary)).not.toContain('private_internal_flag');
    expect(JSON.stringify(summary)).not.toContain('private chain-of-thought');
  });

  it('fails safe when a persisted status is missing or unknown', () => {
    expect(buildCandidateReportPublicationSummary({ latestStatus: 'unexpected_internal_state' }))
      .toMatchObject({
        status: 'status_unavailable',
        tone: 'info',
        nextAction: { type: 'recheck_report', label: 'Recheck report' },
      });
  });
});
