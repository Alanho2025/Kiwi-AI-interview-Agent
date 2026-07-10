import { describe, expect, it } from 'vitest';

import { buildProofStrategyClientSummary } from '../../../src/services/questions/proofStrategyClientSummaryService.js';

describe('proofStrategyClientSummaryService', () => {
  it('returns non-technical preparation details without private evidence or internal IDs', () => {
    const summary = buildProofStrategyClientSummary({
      readiness: {
        status: 'ready',
        representedCoverageIds: ['cov-react', 'cov-node'],
        unresolvedCoverageIds: [],
      },
      poolItems: [
        {
          topic: 'React frontend experience',
          proofPointId: 'cov-react',
          coverageContractIds: ['cov-react'],
          coveragePriority: 'must_cover',
          recommendedEvidenceIds: ['private-evidence-react'],
          evidenceAngle: 'technical_ownership',
        },
        {
          topic: 'Node.js backend ownership',
          proofPointId: 'cov-node',
          coverageContractIds: ['cov-node'],
          coveragePriority: 'must_cover',
          recommendedEvidenceIds: [],
          evidenceAngle: 'gap_validation',
          sourceStage: 'role_fit_fallback',
        },
      ],
    });

    expect(summary).toMatchObject({
      status: 'ready',
      focusAreaCount: 2,
      gapCount: 1,
      fallbackQuestionCount: 1,
      unresolvedCount: 0,
      focusAreas: [
        { label: 'React frontend experience', kind: 'experience' },
        { label: 'Node.js backend ownership', kind: 'gap' },
      ],
    });
    expect(JSON.stringify(summary)).not.toMatch(/private-evidence|cov-react|cov-node|proofPoint|coverageContract/);
  });
});
