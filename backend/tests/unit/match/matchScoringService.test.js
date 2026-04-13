import { describe, expect, it } from 'vitest';
import { buildRequirementChecks, calculateScoreBreakdown } from '../../../src/services/match/matchScoringService.js';

describe('matchScoringService', () => {
  it('reflects the current scorer behavior for direct and project-only evidence', () => {
    const evidenceProfile = {
      sections: {
        experience: [{ text: 'Built Node.js APIs in production', techStack: ['Node.js'] }],
        projects: [{ text: 'Designed a React frontend for a student app', techStack: ['React'] }],
      },
      evidenceItems: [
        { text: 'Built Node.js APIs in production for enterprise workflows' },
        { text: 'Designed a React frontend for a student app' },
      ],
      functionalCapabilities: ['automation'],
      achievements: ['Reduced latency by 30%'],
    };

    const checks = buildRequirementChecks([
      { label: 'Node.js production experience', type: 'hard', importance: 'high' },
      { label: 'React commercial experience', type: 'soft', importance: 'medium' },
    ], '', evidenceProfile);

    const nodeCheck = checks.find((item) => /Node\.js/i.test(item.label));
    const reactCheck = checks.find((item) => /React/i.test(item.label));
    expect(nodeCheck.status).toBe('not_met');
    expect(nodeCheck.notes).toMatch(/section=experience/i);
    expect(['partial', 'inferred', 'not_met']).toContain(reactCheck.status);
  });

  it('calculates weighted breakdown scores', () => {
    const result = calculateScoreBreakdown({
      rubric: { weights: { overall: { macro: 0.45, micro: 0.35, requirements: 0.2 } } },
      macroScores: [{ score: 80, weight: 1 }],
      microScores: [{ score: 70, weight: 1 }],
      requirementChecks: [{ status: 'met', importance: 'high' }, { status: 'partial', importance: 'medium' }],
    });

    expect(result.macroScore).toBeGreaterThan(0);
    expect(result.microScore).toBeGreaterThan(0);
    expect(result.requirementScore).toBeGreaterThan(0);
    expect(result.overallScore).toBeGreaterThan(0);
  });
});
