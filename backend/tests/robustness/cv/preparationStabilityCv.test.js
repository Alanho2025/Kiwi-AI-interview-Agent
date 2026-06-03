import { describe, it } from 'vitest';

import { PREPARATION_STABILITY_GROUPS } from '../../../eval/helpers/preparationStabilitySuite.js';
import { expectPreparationStabilityGroupToPass } from '../../helpers/preparationStabilityTestUtils.js';

describe('preparation stability - CV artifacts', () => {
  it('covers 10 deterministic CV profile parsing cases', () => {
    expectPreparationStabilityGroupToPass({
      group: PREPARATION_STABILITY_GROUPS.cvParsing,
      expectedCount: 10,
    });
  });

  it('covers 10 deterministic CV question seed readiness cases', () => {
    expectPreparationStabilityGroupToPass({
      group: PREPARATION_STABILITY_GROUPS.cvSeeds,
      expectedCount: 10,
    });
  });
});
