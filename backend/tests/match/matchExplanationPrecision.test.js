import { describe, expect, it } from 'vitest';
import { buildExplanation } from '../../src/services/match/matchScoringService.js';

describe('match explanation precision', () => {
  it('does not duplicate the same requirement across gaps and risks', () => {
    const requirementChecks = [
      { label: 'Foundations in C#, .NET, SQL, and Git', type: 'hard', importance: 'high', status: 'not_met', evidence: [], notes: 'missing direct commercial proof' },
      { label: 'Exposure to Azure or CI/CD pipelines', type: 'soft', importance: 'medium', status: 'not_met', evidence: [], notes: 'Direct evidence not found' },
      { label: 'Ability to communicate clearly and learn quickly', type: 'soft', importance: 'high', status: 'met', evidence: ['clear stakeholder updates'], notes: 'direct evidence found' },
    ];
    const microScores = [
      { label: 'communication', score: 88, evidence: ['clear stakeholder updates'] },
      { label: 'SQL', score: 80, evidence: ['SQL reporting'] },
    ];

    const { strengths, gaps, risks } = buildExplanation({ microScores, requirementChecks, cvEvidenceProfile: { functionalCapabilities: ['adaptability'] } });
    const gapIds = new Set(gaps.map((item) => item.id));
    const riskIds = new Set(risks.map((item) => item.id));
    const overlap = [...gapIds].filter((id) => riskIds.has(id));

    expect(overlap).toEqual([]);
    expect(risks.some((item) => item.label === 'Foundations in C#, .NET, SQL, and Git')).toBe(true);
    expect(gaps.some((item) => item.label === 'Exposure to Azure or CI/CD pipelines')).toBe(true);
    expect(strengths.some((item) => /communication/i.test(item.label))).toBe(true);
  });
});
