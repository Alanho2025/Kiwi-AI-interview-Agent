import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../src/services/jobDescription/jobDescriptionAiService.js', () => ({
  extractSkillsWithAI: vi.fn(async () => ({ technicalSkillRequirements: [], softSkillRequirements: [], macroCriteria: [], requirements: [] })),
}));
import { buildStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { loadJdFixture, withDisabledAiEnhancement } from '../../helpers/jobDescriptionTestUtils.js';

let restoreEnv;

describe('JD parse scenarios', () => {
  beforeEach(() => { restoreEnv = withDisabledAiEnhancement(); });
  afterEach(() => { restoreEnv?.(); });

  it('parses a noisy marketing-heavy JD without inventing technical depth', async () => {
    const raw = await loadJdFixture('noisy-marketing-heavy-jd.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.sections.mustHaveRequirements.length).toBeGreaterThan(0);
    expect(rubric.diagnostics.confidence).toBeLessThan(0.85);
  });

  it('parses a senior backend JD with backend family signals', async () => {
    const raw = await loadJdFixture('senior-backend-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.roleFamily).toBeTruthy();
    const groupedSkills = Object.values(rubric.sections.technicalSkills || {}).flat();
    expect(groupedSkills.length).toBeGreaterThan(0);
  });
});
