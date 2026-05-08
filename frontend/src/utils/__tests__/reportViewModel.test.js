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
});
