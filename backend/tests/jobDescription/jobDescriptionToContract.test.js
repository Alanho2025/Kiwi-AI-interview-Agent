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
import { buildNormalizedJdRubric } from '../../src/services/jobDescription/jobDescriptionContractBuilder.js';
import { loadJdFixture, withDisabledAiEnhancement } from '../helpers/jobDescriptionTestUtils.js';

let restoreEnv;

describe('JD parse downstream contract', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('builds a stable normalized contract for match and interview flows', async () => {
    const parsed = await buildStructuredJobDescriptionRubric(await loadJdFixture('graduate-software-developer.txt'));
    const contract = buildNormalizedJdRubric(parsed, {});

    expect(contract.roleTitle).toBe('Graduate Software Developer');
    expect(contract.seniority).toBe('junior');
    expect(contract.requiredSkills).toEqual(expect.arrayContaining(['C#', '.NET', 'SQL', 'Git']));
    expect(contract.preferredSkills).toContain('Exposure to Azure or CI/CD pipelines.');
    expect(contract.educationRequirements.some((item) => /qualification/i.test(item))).toBe(true);
    expect(contract.interviewTargets.length).toBeGreaterThan(0);
    expect(contract.sourceMeta.parserConfidence).toBeGreaterThan(0);
  });
});
