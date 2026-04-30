import { describe, expect, it } from 'vitest';

import { cleanRoleTitleCandidate, extractJobTitle } from '../../../src/services/jobDescription/extractors/titleExtractor.js';

describe('job title extractor marketing-prefix edge cases', () => {
  it.each([
    ['We are hiring a Software Engineer (agentic)', 'Software Engineer (agentic)'],
    ['Hiring for a Senior Backend Engineer', 'Senior Backend Engineer'],
    ['Hiring a Senior Backend Engineer', 'Senior Backend Engineer'],
    ['We are looking for a Full Stack Developer', 'Full Stack Developer'],
    ['Join us as a Data Engineer', 'Data Engineer'],
    ['Open role: Platform Engineer', 'Platform Engineer'],
    ['Now hiring: Machine Learning Engineer', 'Machine Learning Engineer'],
    ['Position: QA Engineer', 'QA Engineer'],
    ['Job Title: AI Engineer', 'AI Engineer'],
  ])('cleans marketing prefix from %s', (input, expected) => {
    expect(extractJobTitle({ lines: [input] }).value).toBe(expected);
  });

  it('keeps real role words that include hiring-related vocabulary', () => {
    expect(cleanRoleTitleCandidate('Hiring Manager')).toBe('Hiring Manager');
  });
});
