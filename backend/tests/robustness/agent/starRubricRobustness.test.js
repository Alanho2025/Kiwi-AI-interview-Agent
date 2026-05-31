import { describe, expect, it } from 'vitest';

import { analyzeStarrBreakdown } from '../../../src/services/aiControl/starRubricService.js';

describe('STARR rubric robustness', () => {
  it('marks result/reaction missing when an answer has action but no outcome', () => {
    const star = analyzeStarrBreakdown('In a frontend dashboard project, my task was to improve maintainability, so I separated the React components.');

    expect(star.action).not.toBe('missing');
    expect(star.resultOrReaction).toBe('missing');
    expect(star.mainMissingElement).toBe('resultOrReaction');
  });

  it('recognises measurable results as clearer STARR evidence', () => {
    const star = analyzeStarrBreakdown('In my role, I implemented caching for the API and reduced latency by 35 percent after testing it with load checks.');

    expect(star.situation).not.toBe('missing');
    expect(star.action).not.toBe('missing');
    expect(star.resultOrReaction).not.toBe('missing');
    expect(star.totalScore).toBeGreaterThanOrEqual(5);
  });
});
