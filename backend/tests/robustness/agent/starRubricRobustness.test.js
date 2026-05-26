import { describe, expect, it } from 'vitest';

import { analyzeStarBreakdown } from '../../../src/services/aiControl/starRubricService.js';

describe('STAR rubric robustness', () => {
  it('marks result missing when an answer has action but no outcome', () => {
    const star = analyzeStarBreakdown('In a frontend dashboard project, my task was to improve maintainability, so I separated the React components.');

    expect(star.action).not.toBe('missing');
    expect(star.result).toBe('missing');
    expect(star.mainMissingElement).toBe('result');
  });

  it('recognises measurable results as clearer STAR evidence', () => {
    const star = analyzeStarBreakdown('In my role, I implemented caching for the API and reduced latency by 35 percent after testing it with load checks.');

    expect(star.situation).not.toBe('missing');
    expect(star.action).not.toBe('missing');
    expect(star.result).not.toBe('missing');
    expect(star.totalScore).toBeGreaterThanOrEqual(5);
  });
});
