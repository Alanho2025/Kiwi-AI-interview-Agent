import { describe, expect, it } from 'vitest';

import { buildRequirementItem } from '../../src/services/scoringSchemaService.js';

describe('scoring schema requirement metadata', () => {
  it('preserves universal capability metadata on requirement items', () => {
    const requirement = buildRequirementItem({
      id: 'clinical-safety',
      label: 'Maintain clinical safety and professional standards',
      type: 'hard',
      category: 'compliance_or_safety',
      capabilityGroup: 'compliance_ethics_safety',
      roleDomain: 'healthcare',
    });

    expect(requirement).toMatchObject({
      requirementId: 'clinical-safety',
      category: 'compliance_or_safety',
      capabilityGroup: 'compliance_ethics_safety',
      roleDomain: 'healthcare',
    });
  });
});
