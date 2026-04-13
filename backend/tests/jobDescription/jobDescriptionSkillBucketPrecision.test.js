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

describe('JD parse skill bucket precision', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('places cloud skills into infrastructure and delivery skills into common engineering', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('cloud-platform-engineer.txt'));

    expect(rubric.sections.technicalSkills.itInfrastructure.map((item) => item.label)).toEqual(
      expect.arrayContaining(['Azure', 'Cloud Infrastructure', 'Linux', 'Networking', 'Troubleshooting']),
    );
    expect(rubric.sections.technicalSkills.commonEngineering.map((item) => item.label)).toEqual(
      expect.arrayContaining(['Deployment', 'Docker', 'Kubernetes']),
    );
    expect(rubric.sections.technicalSkills.data.map((item) => item.label)).not.toContain('Azure');
  });

  it('keeps generic company language out of technical skill buckets', async () => {
    const rubric = await buildStructuredJobDescriptionRubric(await loadJdFixture('noisy-marketing-heavy-jd.txt'));
    const allTechnicalLabels = Object.values(rubric.sections.technicalSkills).flat().map((item) => item.label.toLowerCase());

    expect(allTechnicalLabels).toContain('sql');
    expect(allTechnicalLabels).toContain('snowflake');
    expect(allTechnicalLabels).not.toContain('innovation');
    expect(allTechnicalLabels).not.toContain('coffee');
  });
});
