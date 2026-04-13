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
const toDataSkills = (rubric) => new Set(rubric.sections.technicalSkills.data.map((item) => item.label));

describe('JD parse metamorphic stability', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('keeps core overview and high-value data skills stable across format variants', async () => {
    const clean = await buildStructuredJobDescriptionRubric(await loadJdFixture('data-engineer-clean.txt'));
    const paragraph = await buildStructuredJobDescriptionRubric(await loadJdFixture('data-engineer-paragraph.txt'));
    const headingFree = await buildStructuredJobDescriptionRubric(await loadJdFixture('heading-missing-paragraph.txt'));

    expect(paragraph.jobOverview.title).toBe(clean.jobOverview.title);
    expect(paragraph.roleFamily).toBe(clean.roleFamily);
    expect(paragraph.jobOverview.employmentType).toBe(clean.jobOverview.employmentType);
    expect(headingFree.jobOverview.title).toBe(clean.jobOverview.title);
    expect(headingFree.roleFamily).toBe(clean.roleFamily);

    const cleanSkills = toDataSkills(clean);
    const paragraphSkills = toDataSkills(paragraph);
    const headingFreeSkills = toDataSkills(headingFree);
    for (const skill of ['SQL', 'Snowflake', 'dbt', 'Data Modelling', 'Semantic Layers', 'ADF']) {
      expect(cleanSkills.has(skill)).toBe(true);
      expect(paragraphSkills.has(skill)).toBe(true);
      expect(headingFreeSkills.has(skill)).toBe(true);
    }

    expect(paragraph.sections.responsibilities.length).toBeGreaterThanOrEqual(2);
    expect(paragraph.sections.mustHaveRequirements.length).toBeGreaterThanOrEqual(3);
  });
});
