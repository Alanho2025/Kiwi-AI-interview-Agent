import { describe, expect, it } from 'vitest';
import { buildCvProfile } from '../../src/services/cv/cvProfileBuilderService.js';
import { readCvFixture } from '../helpers/cvTestUtils.js';

describe('buildCvProfile precision', () => {
  it('reads the main graduate CV content correctly', () => {
    const profile = buildCvProfile(readCvFixture('software-engineer-graduate-cv.txt'));

    expect(profile.candidateName).toBe('Alan Ho');
    expect(profile.contact.email).toBe('alan.ho@example.com');
    expect(profile.contact.location).toContain('Auckland');
    expect(profile.summary).toMatch(/Graduate software developer/i);
    expect(profile.projects).toMatch(/Campus Interview Assistant/i);
    expect(profile.experience).toMatch(/Software Engineering Intern/i);
    expect(profile.education).toMatch(/University of Auckland/i);

    const skillLabels = profile.skills.map((item) => item.label);
    expect(skillLabels).toEqual(expect.arrayContaining(['c#', '.net', 'sql', 'git', 'azure', 'testing', 'vitest', 'agile', 'kanban']));
    expect(profile.warnings).toEqual([]);
  });

  it('raises useful warnings for weak CVs with missing structure', () => {
    const profile = buildCvProfile(readCvFixture('weak-cv-missing-experience.txt'));

    expect(profile.candidateName).toBe('Noah Lee');
    expect(profile.projects).toMatch(/University App/i);
    expect(profile.warnings).toEqual(expect.arrayContaining([
      'No clear experience section was detected from the uploaded CV.',
      'No dedicated skills section was detected, so skill extraction may be partial.',
      'No common technical skills were confidently extracted from the current CV text.',
    ]));
  });
});
