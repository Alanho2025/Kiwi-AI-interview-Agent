import { describe, it } from 'vitest';

import { PREPARATION_STABILITY_GROUPS } from '../../../eval/helpers/preparationStabilitySuite.js';
import { expectPreparationStabilityGroupToPass } from '../../helpers/preparationStabilityTestUtils.js';

describe('preparation stability - artifact retrieval', () => {
  it('covers 8 deterministic artifact indexing and retrieval cases', () => {
    expectPreparationStabilityGroupToPass({
      group: PREPARATION_STABILITY_GROUPS.retrieval,
      expectedCount: 8,
    });
  });
});
