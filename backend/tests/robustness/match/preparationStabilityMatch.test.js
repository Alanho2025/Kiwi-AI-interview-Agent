import { describe, it } from 'vitest';

import { PREPARATION_STABILITY_GROUPS } from '../../../eval/helpers/preparationStabilitySuite.js';
import { expectPreparationStabilityGroupToPass } from '../../helpers/preparationStabilityTestUtils.js';

describe('preparation stability - CV-JD match artifacts', () => {
  it('covers 10 deterministic evidence-backed match cases', () => {
    expectPreparationStabilityGroupToPass({
      group: PREPARATION_STABILITY_GROUPS.match,
      expectedCount: 10,
    });
  });
});
