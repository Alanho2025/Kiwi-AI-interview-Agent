import { describe, expect, it } from 'vitest';

import * as formatter from '../reportPdf/reportPdfTemplate.js';

describe('PDF turn framework formatting', () => {
  it('uses server-published framework levels, percentages, and reasons', () => {
    const meta = formatter.buildTurnFrameworkMeta?.({
      frameworkLabel: 'Scenario / Case Reasoning',
      frameworkBreakdown: {
        normalizedScore: 9.9,
        level: 4,
        scorePercent: 75,
        dimensions: [
          { label: 'Requirements', status: 'clear', score: 10, level: 5, scorePercent: 100, reason: 'Requirements were clear.' },
          { label: 'Risk / Quality / Ethics', status: 'partial', score: 5, level: 3, scorePercent: 50, reason: 'Add the risk trade-off.' },
        ],
      },
      scores: { business: 8, logic: 8, evidence: 8 },
    }) || '';

    expect(meta).toContain('Scenario / Case Reasoning Level 4/5, 75/100');
    expect(meta).toContain('Requirements Level 5/5, 100/100: Requirements were clear.');
    expect(meta).toContain('Risk / Quality / Ethics Level 3/5, 50/100: Add the risk trade-off.');
    expect(meta).not.toMatch(/Business|Logic|Evidence/);
    expect(meta).not.toMatch(/\/10\b/);
  });

  it('returns a neutral unavailable result with the fallback label when no formal framework exists', () => {
    const meta = formatter.buildTurnFrameworkMeta?.({
      scores: { business: 6, logic: 7, evidence: 5 },
      durationAssessment: { eligible: false, earnedPoints: 8, maxPoints: 10 },
    }) || '';

    expect(meta).toBe('Role-specific framework unavailable');
    expect(meta).not.toMatch(/Business|Logic|Evidence|\/10\b|earnedPoints|maxPoints/);
  });

  it('preserves a turn framework label in the unavailable PDF metadata', () => {
    const meta = formatter.buildTurnFrameworkMeta?.({
      frameworkLabel: 'Introduction',
      frameworkBreakdown: { dimensions: [] },
    }) || '';

    expect(meta).toBe('Introduction unavailable');
  });

  it('shows Level unavailable when either server framework metric is missing', () => {
    const meta = formatter.buildTurnFrameworkMeta?.({
      frameworkLabel: 'Scenario / Case Reasoning',
      frameworkBreakdown: {
        dimensions: [
          { label: 'Requirements', level: 4, reason: 'Requirements were identified.' },
          { label: 'Approach', scorePercent: 75, reason: 'Approach was described.' },
        ],
      },
    }) || '';

    expect(meta).toContain('Requirements Level unavailable: Requirements were identified.');
    expect(meta).toContain('Approach Level unavailable: Approach was described.');
    expect(meta).not.toMatch(/\/10\b/);
  });

  it('does not treat starApplicable alone as an available STARR breakdown', () => {
    const meta = formatter.buildTurnFrameworkMeta?.({
      frameworkLabel: 'Behavioural',
      starApplicable: true,
      durationAssessment: { eligible: true, level: 4, earnedPoints: 8, maxPoints: 10 },
    }) || '';

    expect(meta).toBe('Behavioural unavailable | Duration Level 4/5');
  });

  it('formats duration with a server-published level', () => {
    const meta = formatter.buildTurnFrameworkMeta?.({
      durationAssessment: { eligible: true, level: 4, earnedPoints: 8, maxPoints: 10 },
    }) || '';

    expect(meta).toBe('Role-specific framework unavailable | Duration Level 4/5');
    expect(meta).not.toContain('8/10');
  });
});
