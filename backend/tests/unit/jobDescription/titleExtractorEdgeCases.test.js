import { describe, expect, it } from 'vitest';
import { extractJobTitle, cleanRoleTitleCandidate } from '../../../src/services/jobDescription/extractors/titleExtractor.js';

const extract = (line) => extractJobTitle({ lines: [line] }).value;

describe('titleExtractor marketing prefix edge cases', () => {
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
    expect(cleanRoleTitleCandidate(input)).toBe(expected);
    expect(extract(input)).toBe(expected);
  });

  it.each([
    'Hiring Manager',
    'Hiring Coordinator',
    'Recruitment Manager',
    'Talent Acquisition Specialist',
    'People & Culture Advisor',
  ])('does not strip real people or recruitment titles: %s', (input) => {
    expect(cleanRoleTitleCandidate(input)).toBe(input);
  });
});
