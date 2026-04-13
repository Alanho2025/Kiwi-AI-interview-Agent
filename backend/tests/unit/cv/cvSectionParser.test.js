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

  it('treats heading-free single-block CV text as header content in the current parser', () => {
    const sections = extractCvSections('Built a food recommendation API for students and improved response times by 40%.');
    expect(sections).toHaveLength(1);
    expect(sections[0].key).toBe('header');
    expect(sections[0].content).toMatch(/food recommendation API/i);
  });
});
