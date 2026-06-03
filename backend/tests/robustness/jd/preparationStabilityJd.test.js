import { describe, it } from 'vitest';

import { PREPARATION_STABILITY_GROUPS } from '../../../eval/helpers/preparationStabilitySuite.js';
import { expectPreparationStabilityGroupToPass } from '../../helpers/preparationStabilityTestUtils.js';

describe('preparation stability - JD artifacts', () => {
  it('covers 12 deterministic JD rubric parsing cases', () => {
    expectPreparationStabilityGroupToPass({
      group: PREPARATION_STABILITY_GROUPS.jdParsing,
      expectedCount: 12,
    });
  });

  it('covers 10 deterministic JD question filter readiness cases', () => {
    expectPreparationStabilityGroupToPass({
      group: PREPARATION_STABILITY_GROUPS.jdFilter,
      expectedCount: 10,
    });
  });
});
