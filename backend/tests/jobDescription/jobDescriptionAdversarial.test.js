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

describe('JD parse adversarial handling', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('does not infer lead level from the word leading', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('data-engineer-leading-company.txt'));

    expect(rubric.jobOverview.title).toBe('Data Engineer');
    expect(rubric.roleLevel).toBe('mid');
    expect(rubric.sections.mustHaveRequirements).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/SQL/i),
        expect.stringMatching(/Snowflake/i),
      ]),
    );
  });

  it('does not treat benefit language as data skills', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('benefit-heavy-jd.txt'));
    const dataSkills = rubric.sections.technicalSkills.data.map((item) => item.label);

    expect(dataSkills).toEqual(expect.arrayContaining(['SQL', 'Reporting', 'Excel']));
    expect(dataSkills).not.toContain('Hybrid work options');
    expect(rubric.sections.mustHaveRequirements.some((item) => /hybrid work/i.test(item))).toBe(false);
  });

  it('keeps noisy marketing text out of company and skills', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('noisy-marketing-heavy-jd.txt'));
    const dataSkills = rubric.sections.technicalSkills.data.map((item) => item.label);

    expect(rubric.jobOverview.companyName).not.toMatch(/what this role does|leading opportunities/i);
    expect(dataSkills).toEqual(expect.arrayContaining(['SQL', 'Snowflake', 'dbt']));
    expect(dataSkills.some((item) => /hybrid|coffee|social club/i.test(item))).toBe(false);
  });
});
