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
const toDataSkills = (rubric) => new Set(rubric.sections.technicalSkills.data.map((item) => item.label));

const buildLowercaseParagraphVariant = (text = '') => String(text || '')
  .replace(/\r/g, '')
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)
  .join(' ')
  .toLowerCase();

const buildReorderedVariant = (text = '') => {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const title = lines.shift() || '';
  const header = [];
  const rest = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^(Company:|Employment type:|Location:)/i.test(trimmed)) header.push(trimmed);
    else rest.push(trimmed);
  }
  return [title, ...header, ...rest.reverse()].join('\n');
};

describe('JD parse metamorphic stability', () => {
  beforeEach(() => {
    restoreEnv = withDisabledAiEnhancement();
  });

  afterEach(() => {
    restoreEnv?.();
  });

  it('keeps core overview and high-value data skills stable across structural variants', async () => {
    const cleanText = await loadJdFixture('data-engineer-clean.txt');
    const clean = await buildStructuredJobDescriptionRubric(cleanText);
    const paragraph = await buildStructuredJobDescriptionRubric(await loadJdFixture('data-engineer-paragraph.txt'));
    const headingFree = await buildStructuredJobDescriptionRubric(await loadJdFixture('heading-missing-paragraph.txt'));
    const lowercaseParagraph = await buildStructuredJobDescriptionRubric(buildLowercaseParagraphVariant(cleanText));
    const reordered = await buildStructuredJobDescriptionRubric(buildReorderedVariant(cleanText));

    for (const variant of [paragraph, headingFree, lowercaseParagraph, reordered]) {
      expect(variant.jobOverview.title).toBe(clean.jobOverview.title);
      expect(variant.roleFamily).toBe(clean.roleFamily);
      expect(variant.jobOverview.employmentType).toBe(clean.jobOverview.employmentType);
    }

    for (const rubric of [clean, paragraph, headingFree, lowercaseParagraph, reordered]) {
      const skills = toDataSkills(rubric);
      for (const skill of ['SQL', 'Snowflake', 'dbt']) {
        expect(skills.has(skill)).toBe(true);
      }
      expect(rubric.sections.mustHaveRequirements.length).toBeGreaterThanOrEqual(2);
    }
  });
});
