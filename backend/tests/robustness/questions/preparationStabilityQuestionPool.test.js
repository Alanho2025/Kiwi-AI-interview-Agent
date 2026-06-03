import { describe, it } from 'vitest';

import { PREPARATION_STABILITY_GROUPS } from '../../../eval/helpers/preparationStabilitySuite.js';
import { expectPreparationStabilityGroupToPass } from '../../helpers/preparationStabilityTestUtils.js';

describe('preparation stability - prepared question pool artifacts', () => {
  it('covers 12 deterministic prepared question pool cases', () => {
    expectPreparationStabilityGroupToPass({
      group: PREPARATION_STABILITY_GROUPS.questionPool,
      expectedCount: 12,
    });
  });
});
