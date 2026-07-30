import { describe, expect, it } from 'vitest';
import {
  hasAwkwardQuestionWording,
  polishQuestionWording,
  compactSpokenJDRequirement,
} from '../../../src/services/questions/questionWordingPolishService.js';

describe('questionWordingPolishService (Spoken Wording Optimization)', () => {
  it('polishes awkward phrase patterns into natural questions', () => {
    const raw = 'Tell me about a time you showed documentation.';
    expect(polishQuestionWording(raw)).toBe(
      'Tell me about a time when you created or improved documentation. What changed afterwards?'
    );
  });

  it('detects awkward wording patterns', () => {
    expect(hasAwkwardQuestionWording('Tell me about a time you showed teamwork.')).toBe(true);
    expect(hasAwkwardQuestionWording('How did you build the database schema?')).toBe(false);
  });

  it('compacts verbose multi-clause JD requirement strings for voice SLA', () => {
    const longJdQuestion =
      'Tell me about one example that shows your evidence for Strong communication skills, able to sit with business units across commercial, marketing, design, manufacturing, and finance, translate technical concepts for non-technical stakeholders, run workshops, and present to senior leadership. What did you personally do, and what was the result?';

    const polished = compactSpokenJDRequirement(longJdQuestion);

    expect(polished.length).toBeLessThan(longJdQuestion.length);
    expect(polished).toMatch(/translated? (?:complex )?technical concepts/i);
    expect(polished.split(/\s+/).length).toBeLessThanOrEqual(28);
  });
});
