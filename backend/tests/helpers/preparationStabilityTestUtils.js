/**
 * File responsibility: Preparation stability Vitest assertions.
 * Main responsibilities:
 * - Keep group-level preparation stability tests thin and consistent.
 * - Assert case counts and failed diagnostics with a readable failure payload.
 */

import { expect } from 'vitest';

import {
  evaluatePreparationStabilityCase,
  getPreparationStabilityCasesByGroup,
} from '../../eval/helpers/preparationStabilitySuite.js';

export const expectPreparationStabilityGroupToPass = ({ group, expectedCount }) => {
  const cases = getPreparationStabilityCasesByGroup(group);
  const results = cases.map((caseItem) => evaluatePreparationStabilityCase(caseItem));
  const failedResults = results.filter((result) => !result.passed);

  expect(cases).toHaveLength(expectedCount);
  expect(failedResults).toEqual([]);
  expect(results.every((result) => result.fallbackConvertedToPass === false)).toBe(true);
};
