import { describe, expect, it } from 'vitest';

import {
  PREPARATION_STABILITY_GROUPS,
  PREPARATION_STABILITY_SUITE,
  buildPreparationStabilitySummary,
  evaluatePreparationStabilityCase,
  preparationStabilityCases,
} from '../../../eval/helpers/preparationStabilitySuite.js';

describe('preparation stability reporting contract', () => {
  it('aggregates the deterministic 80-case preparation stability suite', () => {
    const summary = buildPreparationStabilitySummary();

    expect(preparationStabilityCases).toHaveLength(80);
    expect(summary).toMatchObject({
      suite: PREPARATION_STABILITY_SUITE,
      totalCases: 80,
      passed: 80,
      failed: 0,
      artifactFailures: {
        cvProfileMissing: 0,
        cvSeedsMissing: 0,
        jdRubricMissing: 0,
        jdFilterMissing: 0,
        matchAnalysisMissing: 0,
        questionPoolMissing: 0,
        indexingMissing: 0,
        reportEvidenceMissing: 0,
      },
      fallbackDiagnostics: {
        fallbackTriggered: 0,
        fallbackConvertedToPass: 0,
      },
      stabilityChecks: {
        powerOf3Cases: 3,
        criticalInconsistency: 0,
      },
    });
    expect(summary.groups).toMatchObject({
      [PREPARATION_STABILITY_GROUPS.cvParsing]: { totalCases: 10, passed: 10, failed: 0 },
      [PREPARATION_STABILITY_GROUPS.cvSeeds]: { totalCases: 10, passed: 10, failed: 0 },
      [PREPARATION_STABILITY_GROUPS.jdParsing]: { totalCases: 12, passed: 12, failed: 0 },
      [PREPARATION_STABILITY_GROUPS.jdFilter]: { totalCases: 10, passed: 10, failed: 0 },
      [PREPARATION_STABILITY_GROUPS.match]: { totalCases: 10, passed: 10, failed: 0 },
      [PREPARATION_STABILITY_GROUPS.questionPool]: { totalCases: 12, passed: 12, failed: 0 },
      [PREPARATION_STABILITY_GROUPS.retrieval]: { totalCases: 8, passed: 8, failed: 0 },
      [PREPARATION_STABILITY_GROUPS.report]: { totalCases: 8, passed: 8, failed: 0 },
    });
  });

  it('does not let fallback convert a missing preparation artifact into a pass', () => {
    const result = evaluatePreparationStabilityCase({
      id: 'contract_fallback_cannot_pass_missing_artifact',
      group: PREPARATION_STABILITY_GROUPS.questionPool,
      stage: 'question_pool_composition',
      artifactType: 'question_pool',
      expectedOutcome: 'ready',
      fallback: { triggered: true, convertedToPass: true },
      artifacts: { questionPool: [] },
      expected: { minPoolCount: 1 },
    });

    expect(result.passed).toBe(false);
    expect(result.failedChecks).toEqual(expect.arrayContaining([
      'fallback_converted_to_pass',
      'question_pool_below_minimum',
    ]));
  });
});
