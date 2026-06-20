import { describe, expect, it } from 'vitest';

import * as formatter from '../reportPdf/reportPdfTemplate.js';

describe('PDF turn framework formatting', () => {
  it('uses dynamic framework dimensions for v5 turns', () => {
    const meta = formatter.buildTurnFrameworkMeta?.({
      frameworkLabel: 'Scenario / Case Reasoning',
      frameworkBreakdown: {
        normalizedScore: 7.5,
        dimensions: [
          { label: 'Requirements', status: 'clear', score: 10 },
          { label: 'Risk / Quality / Ethics', status: 'partial', score: 5 },
        ],
      },
      scores: { business: 8, logic: 8, evidence: 8 },
    }) || '';

    expect(meta).toContain('Scenario / Case Reasoning 7.5/10');
    expect(meta).toContain('Requirements 10/10');
    expect(meta).toContain('Risk / Quality / Ethics 5/10');
    expect(meta).not.toMatch(/Business|Logic|Evidence/);
  });

  it('keeps legacy Business/Logic/Evidence metadata when no framework exists', () => {
    const meta = formatter.buildTurnFrameworkMeta?.({ scores: { business: 6, logic: 7, evidence: 5 } }) || '';
    expect(meta).toBe('Business 6 / Logic 7 / Evidence 5');
  });
});
