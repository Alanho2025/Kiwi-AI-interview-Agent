import { describe, expect, it } from 'vitest';
import { compareCvToJobDescription } from '../../src/services/matchService.js';
import { readCvFixture } from '../helpers/cvTestUtils.js';
import { graduateSoftwareDeveloperRubric } from './matchFixtures.js';

describe('CV to JD match end-to-end', () => {
  it('matches a strong graduate software CV to the graduate developer JD', async () => {
    const result = await compareCvToJobDescription(readCvFixture('software-engineer-graduate-cv.txt'), '', graduateSoftwareDeveloperRubric);

    expect(['strong_match', 'moderate_match']).toContain(result.decision.label);
    expect(result.overallScore).toBeGreaterThanOrEqual(60);
    const requirement = result.requirementChecks.find((item) => item.label === 'Foundations in C#, .NET, SQL, and Git');
    expect(requirement.status).toMatch(/met|partial/);
    expect(result.explanation.strengths.some((item) => /C#|\.NET|SQL|Git|Agile/i.test(item.label))).toBe(true);
  });

  it('keeps non-matching hard requirements visible for weaker transition CVs', async () => {
    const result = await compareCvToJobDescription(readCvFixture('data-analyst-transition-cv.txt'), '', graduateSoftwareDeveloperRubric);

    const requirement = result.requirementChecks.find((item) => item.label === 'Foundations in C#, .NET, SQL, and Git');
    expect(['partial', 'inferred', 'not_met']).toContain(requirement.status);
    expect(result.explanation.gaps.length + result.explanation.risks.length).toBeGreaterThan(0);
  });
});
