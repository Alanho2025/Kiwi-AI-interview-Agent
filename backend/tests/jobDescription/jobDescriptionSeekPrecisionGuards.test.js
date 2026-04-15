import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/services/jobDescription/jobDescriptionAiService.js', () => ({
  extractSkillsWithAI: vi.fn(async () => ({ technicalSkillRequirements: [], softSkillRequirements: [], macroCriteria: [], requirements: [] })),
}));
import { buildStructuredJobDescriptionRubric } from '../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { loadJdFixture, withDisabledAiEnhancement } from '../helpers/jobDescriptionTestUtils.js';

let restoreEnv;

describe('JD seek precision guards', () => {
  beforeEach(() => { restoreEnv = withDisabledAiEnhancement(); });
  afterEach(() => { restoreEnv?.(); });

  it('keeps employer questions out of must-have requirements for Flowingly', async () => {
    const raw = await loadJdFixture('seek-flowingly-full-stack-ai-workflow.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.sections.applicationInstructions.join(' ')).toMatch(/right to work in New Zealand/i);
    expect(rubric.sections.mustHaveRequirements.join(' ')).not.toMatch(/right to work in New Zealand/i);
  });

  it('does not move core technical skills into benefits for Serato', async () => {
    const raw = await loadJdFixture('seek-serato-senior-web-software-engineer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.sections.benefits.join(' ')).not.toMatch(/OAuth/i);
    expect(rubric.sections.benefits.join(' ')).not.toMatch(/SQL/i);
  });
});
