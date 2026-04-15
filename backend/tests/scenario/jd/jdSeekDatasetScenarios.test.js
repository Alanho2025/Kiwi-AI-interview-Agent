import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../../src/services/jobDescription/jobDescriptionAiService.js', () => ({
  extractSkillsWithAI: vi.fn(async () => ({ technicalSkillRequirements: [], softSkillRequirements: [], macroCriteria: [], requirements: [] })),
}));
import { buildStructuredJobDescriptionRubric } from '../../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { loadJdFixture, withDisabledAiEnhancement } from '../../helpers/jobDescriptionTestUtils.js';

let restoreEnv;

describe('JD seek benchmark scenarios', () => {
  beforeEach(() => { restoreEnv = withDisabledAiEnhancement(); });
  afterEach(() => { restoreEnv?.(); });

  it('parses Serato senior web engineer with strong web signals', async () => {
    const raw = await loadJdFixture('seek-serato-senior-web-software-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.jobOverview.title).toBe('Senior Web Software Engineer');
    expect(rubric.jobOverview.companyName).toBe('Serato Limited');
    expect(rubric.roleFamily).toBe('software_development');
    expect(rubric.roleLevel).toBe('senior');
    expect(rubric.sections.technicalSkills.softwareDevelopment.map((item) => item.label)).toEqual(expect.arrayContaining(['PHP', 'JavaScript', 'TypeScript']));
  });

  it('parses Counties Energy data and AI engineer with mixed data stack', async () => {
    const raw = await loadJdFixture('seek-counties-energy-data-ai-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.jobOverview.companyName).toBe('Counties Energy Ltd');
    expect(rubric.roleFamily).toBe('data');
    expect(rubric.sections.technicalSkills.data.map((item) => item.label)).toEqual(expect.arrayContaining(['SQL', 'Power Query', 'Power BI', 'Jupyter']));
  });

  it('parses KiwiRail graduate programme as graduate and general', async () => {
    const raw = await loadJdFixture('seek-kiwirail-graduate-programme.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.jobOverview.companyName).toBe('KiwiRail');
    expect(rubric.roleFamily).toBe('general');
    expect(rubric.roleLevel).toBe('graduate');
    expect(rubric.sections.applicationInstructions.join(' ')).toMatch(/academic transcript/i);
  });
});
