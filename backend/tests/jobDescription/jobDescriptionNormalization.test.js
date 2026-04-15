import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/services/jobDescription/jobDescriptionAiService.js', () => ({
  extractSkillsWithAI: vi.fn(async () => ({
    technicalSkillRequirements: [],
    softSkillRequirements: [],
    macroCriteria: [],
    requirements: [],
  })),
}));

import { buildStructuredJobDescriptionRubric } from '../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { loadJdFixture, withDisabledAiEnhancement } from '../helpers/jobDescriptionTestUtils.js';

let restoreEnv;

describe('JD parse bluepoint normalization', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('returns normalized bluepoints plus raw evidence sections', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('data-engineer-clean.txt'));

    expect(rubric.sections.responsibilities).toEqual(expect.arrayContaining(['Data Pipelines', 'Regulated Delivery']));
    expect(rubric.sections.mustHaveRequirements).toEqual(expect.arrayContaining(['SQL', 'Snowflake', 'dbt']));
    expect(rubric.rawSections.responsibilities.join(' ')).toMatch(/build scalable data pipelines/i);
    expect(rubric.evidenceMap['Data Pipelines']?.[0]).toMatch(/data pipelines/i);
    expect(rubric.evidenceMap['Apply with CV']?.[0]).toMatch(/cv/i);
  });
});
