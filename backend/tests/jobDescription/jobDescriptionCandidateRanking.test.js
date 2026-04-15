import { describe, expect, it } from 'vitest';
import { tokenizeJobDescriptionHeaderLines } from '../../src/services/jobDescription/jobDescriptionHeaderTokenizer.js';
import { extractJobDescriptionHeader } from '../../src/services/jobDescription/jobDescriptionHeaderExtractor.js';
import { normalizeJobDescriptionText } from '../../src/services/jobDescription/jobDescriptionTextNormalizer.js';

describe('JD header candidate ranking', () => {
  it('splits same-line header fields before extraction', () => {
    const tokens = tokenizeJobDescriptionHeaderLines([
      'Company: Rewired Consulting. Employment type: Full time. Location: Auckland.'
    ]);

    expect(tokens).toEqual([
      'Company: Rewired Consulting',
      'Employment type: Full time',
      'Location: Auckland'
    ]);
  });

  it('prefers labeled company fields over about headings and section headings', () => {
    const raw = `Data Engineer
About Rewired Consulting
Company: Rewired Consulting
What This Role Does
Employment type: Full time`;
    const normalized = normalizeJobDescriptionText(raw);
    const header = extractJobDescriptionHeader({ rawJD: raw, fallbackTitle: 'Data Engineer', normalized });

    expect(header.companyName).toBe('Rewired Consulting');
    expect(header.employmentType).toBe('Full time');
  });
});
