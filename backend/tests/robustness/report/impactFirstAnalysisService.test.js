import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeImpactFirstAnswer } from '../../../src/services/report/impactFirstAnalysisService.js';
import { callDeepSeek } from '../../../src/services/deepseekService.js';

vi.mock('../../../src/services/deepseekService.js', () => ({
  callDeepSeek: vi.fn(),
}));

describe('analyzeImpactFirstAnswer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates deterministic points based on returned levels', async () => {
    // 1 -> 0%, 2 -> 25%, 3 -> 50%, 4 -> 75%, 5 -> 100%
    const mockResponse = {
      dimensions: [
        { key: 'outcome', level: 5, reason: 'test' },             // 20 * 100% = 20
        { key: 'problem_solving', level: 3, reason: 'test' },     // 15 * 50% = 7.5
        { key: 'personal_role', level: 1, reason: 'test' },       // 15 * 0% = 0
        { key: 'approaches', level: 4, reason: 'test' },          // 20 * 75% = 15
        { key: 'learning', level: 2, reason: 'test' },            // 10 * 25% = 2.5
        { key: 'outcome_placement', level: 5, reason: 'test' },   // 10 * 100% = 10
      ]
    };
    callDeepSeek.mockResolvedValueOnce({
      content: JSON.stringify(mockResponse),
      usage: null,
    });

    const result = await analyzeImpactFirstAnswer({ question: 'test', answer: 'test' });
    
    // total = 20 + 7.5 + 0 + 15 + 2.5 + 10 = 55
    // normalized = 55 / 90 * 10 = 6.11
    
    expect(result.totalContentScore).toBe(55);
    expect(result.normalizedScore).toBe(6.11);
    
    // check statuses
    const outcome = result.dimensions.find(d => d.key === 'outcome');
    expect(outcome.status).toBe('clear');
    
    const problem = result.dimensions.find(d => d.key === 'problem_solving');
    expect(problem.status).toBe('partial');
    
    const role = result.dimensions.find(d => d.key === 'personal_role');
    expect(role.status).toBe('missing');
  });

  it('handles LLM JSON parsing failures gracefully', async () => {
    callDeepSeek.mockResolvedValueOnce({
      content: 'This is not JSON.',
      usage: null,
    });

    const result = await analyzeImpactFirstAnswer({ question: 'test', answer: 'test' });
    
    // Default is level 1 for everything -> 0 points
    expect(result.totalContentScore).toBe(0);
    expect(result.normalizedScore).toBe(0);
    result.dimensions.forEach((d) => {
      expect(d.level).toBe(1);
      expect(d.status).toBe('missing');
    });
  });

  it('identifies the main gap based on the lowest level', async () => {
    const mockResponse = {
      dimensions: [
        { key: 'outcome', level: 5, reason: 'test' },
        { key: 'problem_solving', level: 5, reason: 'test' },
        { key: 'personal_role', level: 5, reason: 'test' },
        { key: 'approaches', level: 5, reason: 'test' },
        { key: 'learning', level: 2, reason: 'lowest gap' },
        { key: 'outcome_placement', level: 5, reason: 'test' },
      ]
    };
    callDeepSeek.mockResolvedValueOnce({
      content: JSON.stringify(mockResponse),
      usage: null,
    });

    const result = await analyzeImpactFirstAnswer({ question: 'test', answer: 'test' });
    
    expect(result.mainGapKey).toBe('learning');
    expect(result.scoreReason).toBe('lowest gap');
  });
});
