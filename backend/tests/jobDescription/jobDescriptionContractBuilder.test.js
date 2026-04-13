import { describe, expect, it } from 'vitest';
import { buildNormalizedJdRubric } from '../../src/services/jobDescription/jobDescriptionContractBuilder.js';

describe('buildNormalizedJdRubric', () => {
  it('separates required and preferred items into a stable rubric contract', () => {
    const rubric = buildNormalizedJdRubric({
      title: 'Graduate Software Developer',
      roleCanonical: 'software_engineer',
      technicalSkillRequirements: ['C#', '.NET', 'SQL'],
      mustHaveRequirements: ['Agile team collaboration'],
      niceToHaveExperience: ['Azure'],
      qualifications: ['Bachelor degree in Computer Science', '1+ year experience building APIs'],
      softSkillRequirements: ['communication'],
      interviewTargets: ['API development'],
    }, {});

    expect(rubric.requiredSkills).toContain('C#');
    expect(rubric.preferredSkills).toContain('Azure');
    expect(rubric.educationRequirements.some((item) => /degree/i.test(item))).toBe(true);
    expect(rubric.interviewTargets).toContain('API development');
  });
});
