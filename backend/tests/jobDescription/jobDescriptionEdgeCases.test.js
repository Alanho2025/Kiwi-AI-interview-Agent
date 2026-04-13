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

describe('JD parse edge cases', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('returns a safe fallback contract for empty JD input', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('empty-jd.txt'));

    expect(rubric.jobOverview.title).toBe('Target Role');
    expect(rubric.sections.mustHaveRequirements).toHaveLength(0);
    expect(rubric.sections.niceToHaveRequirements).toHaveLength(0);
    expect(rubric.sections.benefits).toHaveLength(0);
    expect(rubric.sections.applicationInstructions).toHaveLength(0);
  });

  it('can still infer useful skills from a heading-free paragraph JD', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('heading-missing-paragraph.txt'));
    const dataSkills = rubric.sections.technicalSkills.data.map((item) => item.label);

    expect(rubric.jobOverview.title).toBe('Data Engineer');
    expect(dataSkills).toEqual(expect.arrayContaining(['SQL', 'Snowflake', 'dbt', 'Data Modelling', 'Semantic Layers', 'ADF']));
    expect(rubric.sections.softSkills).toContain('Communication');
  });
});
