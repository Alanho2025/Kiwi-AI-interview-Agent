import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/jobDescription/jobDescriptionAiService.js', () => ({
  extractSkillsWithAI: vi.fn(async () => ({
    technicalSkillRequirements: [],
    softSkillRequirements: [],
    macroCriteria: [],
    requirements: [],
  })),
}));

import { buildStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { cleanRoleTitleCandidate, extractJobTitle } from '../../../src/services/jobDescription/extractors/titleExtractor.js';
import { loadJdFixture, withDisabledAiEnhancement } from '../../helpers/jobDescriptionTestUtils.js';

let restoreEnv;

const technicalLabels = (rubric) => Object.values(rubric.sections.technicalSkills || {})
  .flat()
  .map((item) => item.label || item.name || item);

describe('JD parsing robustness', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('strips marketing prefixes without damaging real role titles', () => {
    expect(extractJobTitle({ lines: ['We are hiring a Software Engineer (agentic)'] }).value).toBe('Software Engineer (agentic)');
    expect(extractJobTitle({ lines: ['Join us as a Data Engineer'] }).value).toBe('Data Engineer');
    expect(extractJobTitle({ lines: ['Open role: Platform Engineer'] }).value).toBe('Platform Engineer');
    expect(cleanRoleTitleCandidate('Hiring Manager')).toBe('Hiring Manager');
  });

  it('does not confuse lead-level seniority with the word leading in company copy', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('data-engineer-leading-company.txt'));

    expect(rubric.jobOverview.title).toBe('Data Engineer');
    expect(rubric.roleLevel).toBe('mid');
    expect(rubric.sections.mustHaveRequirements).toEqual(expect.arrayContaining([
      expect.stringMatching(/SQL/i),
      expect.stringMatching(/Snowflake/i),
    ]));
  });

  it('keeps benefits and culture noise out of technical skills and must-have requirements', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('benefit-heavy-jd.txt'));
    const labels = technicalLabels(rubric);
    const mustHaveText = rubric.sections.mustHaveRequirements.join(' ');

    expect(labels).toEqual(expect.arrayContaining(['SQL', 'Reporting', 'Excel']));
    expect(labels).not.toContain('Hybrid work options');
    expect(mustHaveText).not.toMatch(/hybrid work|coffee|social club/i);
  });

  it('extracts useful skills from heading-free paragraph JDs without requiring perfect structure', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('heading-missing-paragraph.txt'));
    const labels = technicalLabels(rubric);

    expect(rubric.jobOverview.title).toBe('Data Engineer');
    expect(labels).toEqual(expect.arrayContaining(['SQL', 'Snowflake', 'dbt', 'Data Modelling']));
    expect(rubric.sections.softSkills).toContain('Communication');
  });

  it('returns a safe empty contract for blank JD text instead of inventing requirements', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('empty-jd.txt'));

    expect(rubric.jobOverview.title).toBe('Target Role');
    expect(rubric.sections.mustHaveRequirements).toHaveLength(0);
    expect(rubric.sections.niceToHaveRequirements).toHaveLength(0);
    expect(rubric.sections.benefits).toHaveLength(0);
    expect(rubric.sections.applicationInstructions).toHaveLength(0);
  });
});
