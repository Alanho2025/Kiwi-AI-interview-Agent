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
        'Data Pipelines',
        'Regulated Delivery',
      ]),
    );
    expect(rubric.sections.mustHaveRequirements).toEqual(
      expect.arrayContaining(['SQL', 'Snowflake', 'dbt', 'Data Modelling']),
    );
    expect(rubric.sections.niceToHaveRequirements).toEqual(
      expect.arrayContaining(['Semantic Layers', 'ADF']),
    );
    expect(rubric.sections.benefits).toEqual(
      expect.arrayContaining(['Hybrid Work', 'Learning Budget']),
    );
    expect(rubric.sections.applicationInstructions).toEqual(
      expect.arrayContaining(['Apply with CV', 'Cover Letter Required']),
    );
    expect(rubric.rawSections.benefits).toEqual(
      expect.arrayContaining(['Hybrid work options.', 'Professional development budget.']),
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
