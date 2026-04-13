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

describe('buildStructuredJobDescriptionRubric', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('extracts overview, sections, and skill buckets from a structured JD', async () => {
    const rawJD = await loadJdFixture('data-engineer-clean.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD);

    expect(rubric.jobOverview.title).toBe('Data Engineer');
    expect(rubric.jobOverview.companyName).toBe('Rewired Consulting');
    expect(rubric.jobOverview.employmentType).toBe('Full time');
    expect(rubric.roleFamily).toBe('data');
    expect(rubric.roleLevel).toBe('mid');

    expect(rubric.sections.responsibilities).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/data pipelines/i),
        expect.stringMatching(/regulated environment/i),
      ]),
    );
    expect(rubric.sections.mustHaveRequirements).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Snowflake/i),
        expect.stringMatching(/dbt/i),
        expect.stringMatching(/data modelling/i),
      ]),
    );
    expect(rubric.sections.niceToHaveRequirements).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/semantic layers/i),
        expect.stringMatching(/ADF/i),
      ]),
    );
    expect(rubric.sections.benefits).toEqual(
      expect.arrayContaining(['Hybrid work options.', 'Professional development budget.']),
    );
    expect(rubric.sections.applicationInstructions).toEqual(
      expect.arrayContaining(['Apply with your CV and cover letter.']),
    );

    expect(rubric.sections.technicalSkills.data.map((item) => item.label)).toEqual(
      expect.arrayContaining(['SQL', 'Snowflake', 'dbt', 'Data Modelling', 'Semantic Layers', 'ADF']),
    );
    expect(rubric.sections.softSkills).toContain('Communication');
  });

  it('keeps a short generic JD conservative instead of inventing detail', async () => {
    const rawJD = await loadJdFixture('short-generic-role.txt');
    const rubric = await buildStructuredJobDescriptionRubric(rawJD);

    expect(rubric.jobOverview.title).toBe('Technology Specialist');
    expect(rubric.sections.mustHaveRequirements).toHaveLength(2);
    expect(rubric.sections.benefits).toHaveLength(0);
    expect(rubric.sections.applicationInstructions).toHaveLength(0);
    expect(rubric.roleFamily).toBeTruthy();
    expect(rubric.diagnostics.confidence).toBeLessThan(0.8);
  });
});
