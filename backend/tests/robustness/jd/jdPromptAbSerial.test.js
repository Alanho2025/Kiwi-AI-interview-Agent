import { describe, expect, it } from 'vitest';

import {
  aggregateSerialRuns,
  buildSerialRunPlan,
  DEFAULT_REPEAT_COUNT,
  parseRepeatCount,
  validateChildSummary,
} from '../../../eval/runners/runJdPromptAbSerial.js';

describe('bounded serial JD prompt A/B runner', () => {
  it('uses three repeats by default and accepts only integer counts from one to three', () => {
    expect(DEFAULT_REPEAT_COUNT).toBe(3);
    expect(parseRepeatCount()).toBe(3);
    expect(parseRepeatCount(1)).toBe(1);
    expect(parseRepeatCount('2')).toBe(2);
    expect(parseRepeatCount(3)).toBe(3);
  });

  it.each([0, -1, 1.5, 4, 'not-a-number', '', null, true, NaN, Infinity])(
    'rejects invalid repeat count %s',
    (value) => {
      expect(() => parseRepeatCount(value)).toThrow(/integer from 1 to 3/);
    },
  );

  it('builds a legacy-then-xml plan for every round', () => {
    expect(buildSerialRunPlan(3)).toEqual([
      { round: 1, variant: 'legacy' },
      { round: 1, variant: 'xml' },
      { round: 2, variant: 'legacy' },
      { round: 2, variant: 'xml' },
      { round: 3, variant: 'legacy' },
      { round: 3, variant: 'xml' },
    ]);
  });

  it('accepts a completed child summary even when provider telemetry records fallback data', () => {
    const summary = {
      casesRun: 2,
      casesCompleted: 2,
      failedCases: [],
      providerFallbackReviews: 2,
      providerTimeoutReviews: 1,
    };

    expect(validateChildSummary(summary)).toBe(summary);
  });

  it.each([
    [{ casesRun: 0, casesCompleted: 0, failedCases: [] }, /casesRun/],
    [{ casesRun: 2, casesCompleted: 1, failedCases: [] }, /casesCompleted/],
    [{ casesRun: 2, casesCompleted: 2, failedCases: [{ id: 'fixture-1' }] }, /failedCases/],
    [{ casesCompleted: 2, failedCases: [] }, /casesRun/],
  ])('rejects an incomplete or failed child summary', (summary, expectedError) => {
    expect(() => validateChildSummary(summary)).toThrow(expectedError);
  });

  it('aggregates variant averages and score deltas without raw provider data', () => {
    const summary = (label, source, average, criticalAverage) => ({
      label,
      source,
      casesRun: 2,
      casesCompleted: 2,
      average,
      criticalAverage,
      failedCases: [],
      safeguardReparseCases: 1,
      providerTimeoutAttempts: 0,
      providerFallbackReviews: 0,
      providerTimeoutReviews: 0,
      results: [{ prompt: 'must not be copied', providerResponse: 'must not be copied' }],
    });

    const aggregate = aggregateSerialRuns({
      repeatCount: 2,
      runs: [
        { round: 1, variant: 'legacy', summary: summary('legacy-r1', 'legacy-head', 0.5, 0.4) },
        { round: 1, variant: 'xml', summary: summary('xml-r1', 'working-tree', 0.7, 0.6) },
        { round: 2, variant: 'legacy', summary: summary('legacy-r2', 'legacy-head', 0.6, 0.5) },
        { round: 2, variant: 'xml', summary: summary('xml-r2', 'working-tree', 0.8, 0.7) },
      ],
    });

    expect(aggregate).toMatchObject({
      repeatCount: 2,
      executionProtocol: {
        providerConcurrency: 'serial',
        legacyMustExitBeforeXml: true,
        caseOrder: 'sequential',
      },
      legacyAverage: 0.55,
      xmlAverage: 0.75,
      legacyCriticalAverage: 0.45,
      xmlCriticalAverage: 0.65,
      delta: {
        average: { score: 0.2, percentagePoints: 20 },
        criticalAverage: { score: 0.2, percentagePoints: 20 },
      },
    });
    expect(aggregate.rounds).toHaveLength(2);
    expect(aggregate.rounds[0]).toMatchObject({
      round: 1,
      order: ['legacy', 'xml'],
      delta: { average: { score: 0.2, percentagePoints: 20 } },
    });
    expect(JSON.stringify(aggregate)).not.toContain('must not be copied');
  });
});
