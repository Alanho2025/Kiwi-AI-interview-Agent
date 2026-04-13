import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/services/jobDescription/jobDescriptionAiService.js', () => ({
  extractSkillsWithAI: vi.fn(async () => ({ technicalSkillRequirements: [], softSkillRequirements: [], macroCriteria: [], requirements: [] })),
}));
import { buildStructuredJobDescriptionRubric } from '../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { loadJdFixture, withDisabledAiEnhancement } from '../helpers/jobDescriptionTestUtils.js';

let restoreEnv;

describe('jd parse flow', () => {
  beforeEach(() => { restoreEnv = withDisabledAiEnhancement(); });
  afterEach(() => { restoreEnv?.(); });

  it('builds a structured rubric from raw JD text', async () => {
    const raw = await loadJdFixture('cloud-platform-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.jobOverview.title).toBeTruthy();
    expect(rubric.sections.mustHaveRequirements.length).toBeGreaterThan(0);
    expect(rubric.interviewTargets.prioritySkills.length).toBeGreaterThan(0);
  });
});
