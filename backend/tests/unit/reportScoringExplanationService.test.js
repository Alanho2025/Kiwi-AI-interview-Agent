import { describe, expect, it } from 'vitest';

import { buildScoreExplanations } from '../../src/services/report/reportScoringExplanationService.js';

describe('report scoring explanation v5', () => {
  it('explains interview performance using applicable framework turn scores', () => {
    const explanations = buildScoreExplanations({
      scores: { overall: 72, cvJdMatch: 74, interviewPerformance: 70 },
      candidateFeedback: {
        turnBreakdowns: [
          {
            question: 'Role question',
            frameworkKey: 'role_specific_reasoning',
            frameworkLabel: 'Role-specific Reasoning',
            starApplicable: false,
            frameworkBreakdown: { normalizedScore: 8, mainGapKey: 'validationVerification' },
          },
          {
            question: 'Behavioural question',
            frameworkKey: 'behavioural_starr',
            frameworkLabel: 'STARR',
            starApplicable: true,
            frameworkBreakdown: { normalizedScore: 6, mainGapKey: 'reflection' },
          },
        ],
      },
    });

    expect(explanations.interviewPerformance.formula).toBe('Average of applicable framework turn scores, converted to 0–100');
    expect(explanations.frameworkRules.turnLevelBreakdowns).toEqual([
      expect.objectContaining({ frameworkKey: 'role_specific_reasoning', score: 8, mainGapKey: 'validationVerification' }),
      expect.objectContaining({ frameworkKey: 'behavioural_starr', score: 6, mainGapKey: 'reflection' }),
    ]);
    expect(explanations).not.toHaveProperty('starStructure');
  });
});
