import { describe, expect, it } from 'vitest';
import { compareCvToJobDescription } from '../../src/services/matchService.js';
import { readCvFixture } from '../helpers/cvTestUtils.js';
import { graduateSoftwareDeveloperRubric } from './matchFixtures.js';

describe('match regression guards', () => {
  it('does not mark inferred-only hard requirement risk as a hard gate failure', async () => {
    const result = await compareCvToJobDescription(readCvFixture('project-heavy-student-cv.txt'), '', graduateSoftwareDeveloperRubric);

    const stackRequirement = result.requirementChecks.find((item) => item.label === 'Foundations in C#, .NET, SQL, and Git');
    expect(stackRequirement.status).toMatch(/met|partial|inferred/);
    if (stackRequirement.status !== 'not_met') {
      expect(result.decision.label).not.toBe('not_qualified');
    }
  });

  it('still surfaces clearly missing hard requirements for weak CVs', async () => {
    const result = await compareCvToJobDescription(readCvFixture('weak-cv-missing-experience.txt'), '', graduateSoftwareDeveloperRubric);

    expect(result.requirementChecks.some((item) => item.type === 'hard' && item.status === 'not_met')).toBe(true);
    expect(result.decision.label).toBe('not_qualified');
  });
});
