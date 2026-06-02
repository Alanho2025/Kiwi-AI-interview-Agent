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

  it('includes reflection as the fifth STARR evidence element', () => {
    const star = analyzeStarrBreakdown('During the Kiwi Coach project, my task was to improve report feedback. I implemented a clearer STARR evidence display and tested the result. I learned that reflection should be shown separately.');

    expect(star).toHaveProperty('situation');
    expect(star).toHaveProperty('task');
    expect(star).toHaveProperty('action');
    expect(star).toHaveProperty('resultOrReaction');
    expect(star).toHaveProperty('reflection');
    expect(star.maxScore).toBe(10);
  });

  it('prioritises missing core STARR evidence before reflection', () => {
    const star = analyzeStarrBreakdown('I learned that interview practice can improve confidence and I would do better next time.');

    expect(star.reflection).not.toBe('missing');
    expect(['situation', 'task', 'action', 'resultOrReaction']).toContain(star.mainMissingElement);
    expect(star.scoreReason).toContain('situation, task, action, and result');
  });
});
