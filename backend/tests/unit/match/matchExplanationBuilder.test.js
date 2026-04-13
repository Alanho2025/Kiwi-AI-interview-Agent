import { describe, expect, it } from 'vitest';
import { buildMatchExplanation } from '../../../src/services/match/matchExplanationBuilder.js';

describe('buildMatchExplanation', () => {
  it('summarizes strengths, gaps, and risks into a readable explanation', () => {
    const explanation = buildMatchExplanation({
      strengths: ['Strong API delivery', 'Good SQL evidence'],
      gaps: ['Limited cloud depth'],
      risks: ['Commercial proof is thin'],
    });

    expect(explanation.summary).toMatch(/Strongest aligned evidence/i);
    expect(explanation.summary).toMatch(/Most visible gaps/i);
    expect(explanation.summary).toMatch(/Main validation risks/i);
  });
});
