import { SECTION_HEADING_RULES } from './lexicons/jobDescriptionHeadingLexicon.js';

export const detectJobDescriptionHeadings = (blocks = []) => {
  const headings = [];

  blocks.forEach((block, index) => {
    const text = block.text || '';
    for (const rule of SECTION_HEADING_RULES) {
      if (rule.patterns.some((pattern) => pattern.test(text))) {
        headings.push({
          blockIndex: index,
          rawHeading: text,
          normalizedSectionType: rule.type,
          confidence: 0.95,
        });
        break;
      }
    }
  });

  return headings;
};
