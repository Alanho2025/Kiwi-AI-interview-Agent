import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCandidateFeedback } from '../../../src/services/reportCoachingService.js';
import { calculateProgressAnalytics } from '../../../src/services/session/progressAnalyticsService.js';
import * as deepseekModule from '../../../src/services/deepseekService.js';

describe('Phase 2 - F-36, F-38 & F-76: STAR Review, Coaching Rewrites & Progress Analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.AI_TEST_MODE = 'mock';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.AI_TEST_MODE;
  });

  it('targets missing STAR components (missing Result) and generates structured feedback', async () => {
    vi.spyOn(deepseekModule, 'callDeepSeek').mockResolvedValueOnce({
      content: JSON.stringify({
        overallTakeaway: 'Great progress overall.',
        scoreBand: 'Good',
        turnBreakdowns: [
          {
            question: 'Describe a project challenge.',
            answer: 'I set up Docker containers for the backend service.',
            feedback: 'Answer lacks result metrics.',
            starBreakdown: {
              situation: 'clear',
              task: 'clear',
              action: 'clear',
              result: 'missing',
              mainMissingElement: 'result',
              scoreReason: 'The answer includes action but does not provide a measurable result or impact.',
            },
          },
        ],
      }),
      usage: null,
    });

    const deterministicFeedback = {
      overallTakeaway: 'The answer includes context but lacks measurable outcome.',
      turnBreakdowns: [
        {
          question: 'Describe a project challenge.',
          answer: 'I set up Docker containers for the backend service.',
          feedback: 'Answer lacks result metrics.',
          starBreakdown: {
            situation: 'clear',
            task: 'clear',
            action: 'clear',
            result: 'missing',
            mainMissingElement: 'result',
            scoreReason: 'The answer includes action but does not provide a measurable result or impact.',
          },
        },
      ],
    };

    const feedback = await generateCandidateFeedback({
      session: {},
      analysisResult: {},
      interviewPlan: {},
      evidenceSummary: { averageStrength: 2.5, totals: { direct_past_experience: 1 } },
      deterministicFeedback,
    });

    const turn = feedback.turnBreakdowns[0];
    expect(turn.starBreakdown.result).toBe('missing');
    expect(turn.starBreakdown.mainMissingElement).toBe('result');
    expect(turn.starBreakdown.scoreReason).toContain('does not provide a measurable result');
  });

  it('computes multi-session progress analytics rollup returning insufficient_data when session list is empty', async () => {
    const analytics = await calculateProgressAnalytics({
      userId: 'user-analytics-1',
      sessions: [],
    });

    expect(analytics).toBeDefined();
    expect(analytics.analyticsStatus).toBe('insufficient_data');
    expect(analytics.sessionCount).toBe(0);
    expect(analytics.message).toContain('At least 2 comparable sessions');
  });
});
