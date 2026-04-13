import { describe, expect, it } from 'vitest';
import { extractCvSections } from '../../../src/services/cv/cvSectionParser.js';

describe('extractCvSections', () => {
  it('detects named sections in a conventional CV', () => {
    const text = `Alan Ho
Summary
Graduate engineer focused on backend systems
Projects
Forkcast API
Skills
Node.js
SQL
Education
University of Auckland`;
    const sections = extractCvSections(text);
    expect(sections.map((item) => item.key)).toEqual(expect.arrayContaining(['header', 'summary', 'projects', 'skills', 'education']));
  });

  it('falls back to full_text when no headings are present', () => {
    const sections = extractCvSections('Built a food recommendation API for students and improved response times by 40%.');
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('full_text');
  });
});
