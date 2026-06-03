import { describe, it } from 'vitest';

import { PREPARATION_STABILITY_GROUPS } from '../../../eval/helpers/preparationStabilitySuite.js';
import { expectPreparationStabilityGroupToPass } from '../../helpers/preparationStabilityTestUtils.js';

describe('preparation stability - report evidence and QA artifacts', () => {
  it('covers 8 deterministic report evidence grounding and QA cases', () => {
    expectPreparationStabilityGroupToPass({
      group: PREPARATION_STABILITY_GROUPS.report,
      expectedCount: 8,
    });
  });
});
