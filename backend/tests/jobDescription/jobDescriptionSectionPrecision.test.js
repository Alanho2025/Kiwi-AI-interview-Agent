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

describe('JD parse section precision', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('keeps bonus requirements out of must-have requirements', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('data-engineer-clean.txt'));
    const mustHave = rubric.sections.mustHaveRequirements.join('\n').toLowerCase();
    const niceToHave = rubric.sections.niceToHaveRequirements.join('\n').toLowerCase();

    expect(mustHave).not.toContain('semantic layers');
    expect(mustHave).not.toContain('adf');
    expect(niceToHave).toContain('semantic layers');
    expect(niceToHave).toContain('adf');
  });

  it('keeps application notes and benefits out of qualifications', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('benefit-heavy-jd.txt'));
    const qualifications = rubric.sections.qualifications.join('\n').toLowerCase();

    expect(qualifications).not.toContain('annual bonus');
    expect(qualifications).not.toContain('learning budget');
    expect(qualifications).not.toContain('submit your cv');
    expect(rubric.sections.benefits).toEqual(expect.arrayContaining(['Hybrid Work', 'Annual Bonus', 'Learning Budget']));
    expect(rubric.sections.applicationInstructions).toEqual(expect.arrayContaining(['Apply with CV']));
    expect(rubric.rawSections.applicationInstructions).toEqual(expect.arrayContaining(['Submit your CV.']));
  });
});
