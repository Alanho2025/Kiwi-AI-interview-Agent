import { describe, expect, it } from 'vitest';

import { resolveReportPublicationSummary } from '../reportPublicationSummary.js';

describe('resolveReportPublicationSummary', () => {
  it('uses the backend candidate-safe summary when available', () => {
    const publicationSummary = {
      status: 'needs_review',
      title: 'Backend-owned candidate-safe title',
    };

    expect(resolveReportPublicationSummary({ publicationSummary })).toBe(publicationSummary);
  });

  it('maps historical report records without exposing raw QA flags', () => {
    const summary = resolveReportPublicationSummary({
      latestStatus: 'repair_failed',
      qaResult: { qualityFlags: ['private_internal_flag'] },
    });

    expect(summary).toMatchObject({
      status: 'verification_incomplete',
      title: 'Report verification is incomplete',
      nextAction: { type: 'recheck_report', label: 'Recheck report' },
    });
    expect(JSON.stringify(summary)).not.toContain('private_internal_flag');
  });
});
