import { describe, expect, it } from 'vitest';
import { normalizeCvEvidence } from '../../../src/services/cv/cvEvidenceNormalizer.js';

describe('normalizeCvEvidence', () => {
  it('extracts quantified, delivery, leadership, and technical depth evidence', () => {
    const evidence = normalizeCvEvidence({
      projects: ['Built and deployed a recommendation API to production'],
      achievements: ['Reduced manual review time by 50%'],
      workHistory: ['Led a cross-functional rollout and debugged backend incidents'],
    });

    expect(evidence.quantifiedEvidence.some((item) => item.includes('50%'))).toBe(true);
    expect(evidence.deliveryEvidence.join(' ')).toMatch(/deployed|production/i);
    expect(evidence.leadershipEvidence.join(' ')).toMatch(/Led/i);
    expect(evidence.technicalDepthEvidence.join(' ')).toMatch(/Built|debugged/i);
  });
});
