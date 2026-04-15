import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../src/services/jobDescription/jobDescriptionAiService.js', () => ({
  extractSkillsWithAI: vi.fn(async () => ({ technicalSkillRequirements: [], softSkillRequirements: [], macroCriteria: [], requirements: [] })),
}));
import { buildStructuredJobDescriptionRubric } from '../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { loadJdFixture, withDisabledAiEnhancement } from '../helpers/jobDescriptionTestUtils.js';

let restoreEnv;

describe('JD confidence calibration', () => {
  beforeEach(() => { restoreEnv = withDisabledAiEnhancement(); });
  afterEach(() => { restoreEnv?.(); });

  it('exposes parser self-confidence metadata and evidence', async () => {
    const raw = await loadJdFixture('seek-essential-bulk-junior-ai-systems-developer.txt');
    const rubric = await buildStructuredJobDescriptionRubric(raw);
    expect(rubric.metadata.parserSelfConfidence).toBeGreaterThan(0.45);
    expect(rubric.metadata.extractionCoverage).toBeGreaterThan(0);
    expect(rubric.metadata.fieldEvidence.title.length).toBeGreaterThan(0);
  });
});
