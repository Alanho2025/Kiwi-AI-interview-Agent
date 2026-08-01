import { describe, expect, it } from 'vitest';
import { buildReportViewModel } from '../reportView/index.js';

describe('report view model', () => {
  it('exposes NZ workplace fit data for report rendering', () => {
    const nzWorkplaceFit = {
      enabled: true,
      score: 6.8,
      summary: 'Useful NZ workplace communication signals.',
      dimensionScores: [],
      strengths: [],
      gaps: [],
      evidence: [],
      suggestedRewrite: null,
    };

    const viewModel = buildReportViewModel({
      report: {
        scores: { overall: 70 },
        candidateFeedback: {},
        nzWorkplaceFit,
      },
      qaResult: {},
    });

    expect(viewModel.nzWorkplaceFit).toBe(nzWorkplaceFit);
  });

  it('hides unsafe legacy rewrites and asks the user to regenerate', () => {
    const viewModel = buildReportViewModel({
      report: {
        schemaVersion: 'v5',
        scores: { overall: 58.6, cvJdMatch: 64.3 },
        candidateFeedback: {
          answerRewriteExamples: [{ weak: 'Raw answer', better: 'Action: [補充情境]' }],
        },
      },
      qaResult: {},
    });

    expect(viewModel.report.scores).toEqual({ overall: 58.6, cvJdMatch: 64.3 });
    expect(viewModel.answerRewriteTips[0]).toMatchObject({ status: 'unavailable', better: '' });
    expect(viewModel.legacyReportNotice).toMatch(/Regenerate this report for corrected scoring/i);
  });

  it('uses interview-performance language instead of a historical match band', () => {
    const viewModel = buildReportViewModel({
      report: {
        scores: { overall: 82 },
        candidateFeedback: { scoreBand: 'Strong match' },
      },
      qaResult: {},
    });

    expect(viewModel.scoreBand).toBe('Strong performance');
  });
});
