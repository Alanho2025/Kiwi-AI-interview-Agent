import { describe, expect, it } from 'vitest';

import { formatReportAsText } from '../../../src/controllers/reportController.js';

describe('Role-Fit report text export', () => {
  it('exports role focus coverage and answer alignment in plain English', () => {
    const text = formatReportAsText({
      sessionId: 'session-role-fit-export',
      latestStatus: 'ready',
      report: {
        schemaVersion: 'v7',
        roleFit: {
          status: 'ready',
          roleIntentCoverage: {
            total: 1,
            covered: 1,
            partial: 0,
            missing: 0,
            items: [{ label: 'Reliable production delivery', status: 'covered' }],
          },
          evidenceUsageMap: {
            totalUses: 1,
            items: [{ label: 'Evidence for reliable production delivery', useCount: 1 }],
          },
          answerAlignments: [{
            question: 'Tell me about a production delivery improvement.',
            label: 'strong',
            score: 88,
            diagnosis: { mainIssue: 'The answer used clear ownership and a measurable result.' },
          }],
        },
      },
      qaResult: {},
    });

    expect(text).toContain('HOW YOUR ANSWERS MATCHED THIS ROLE');
    expect(text).toContain('1 of 1 focus areas clearly demonstrated');
    expect(text).toContain('Reliable production delivery: Clearly demonstrated');
    expect(text).toContain('Strong match for this answer (88/100)');
    expect(text).not.toMatch(/proofPointId|coverageId|evidenceId/);
  });
});
