import { describe, expect, it } from 'vitest';
import { buildCvProfile } from '../../src/services/cv/cvProfileBuilderService.js';
import { readCvFixture } from '../helpers/cvTestUtils.js';

describe('buildCvEvidenceProfile precision', () => {
  it('builds evidence sections, achievements, and capabilities from the CV', () => {
    const profile = buildCvProfile(readCvFixture('software-engineer-graduate-cv.txt'));
    const evidence = profile.evidenceProfile;

    expect(evidence.sections.projects.length).toBeGreaterThan(0);
    expect(evidence.sections.experience.length).toBeGreaterThan(0);
    expect(evidence.sections.skills).toEqual(expect.arrayContaining(['c#', '.net', 'sql', 'git']));
    expect(evidence.achievements.some((item) => /50%|15% to 5%/.test(item.text))).toBe(true);
    expect(evidence.evidenceItems.some((item) => item.sourceType === 'project_responsibility')).toBe(true);
    expect(evidence.functionalCapabilities.length).toBeGreaterThan(0);
  });
});
