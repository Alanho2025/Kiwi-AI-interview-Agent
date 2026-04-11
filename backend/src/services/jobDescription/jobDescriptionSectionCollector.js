import { segmentBlockItems } from './utils/itemSegmentationUtils.js';

const createEmptySections = () => ({
  introduction: [],
  responsibilities: [],
  qualifications: [],
  softSkillPersona: [],
  benefits: [],
  companyContext: [],
  applicationInstructions: [],
});

const buildHeadingIndexMap = (detectedHeadings = []) => new Map(detectedHeadings.map((item) => [item.blockIndex, item]));

export const collectJobDescriptionSections = ({ blocks = [], detectedHeadings = [] }) => {
  const sections = createEmptySections();
  const headingMap = buildHeadingIndexMap(detectedHeadings);
  let currentSection = 'introduction';

  blocks.forEach((block, index) => {
    const heading = headingMap.get(index);
    if (heading) {
      currentSection = heading.normalizedSectionType;
      return;
    }

    segmentBlockItems(block.text).forEach((itemText) => {
      sections[currentSection].push({
        id: `${currentSection}-${block.lineStart}-${sections[currentSection].length + 1}`,
        text: itemText,
        normalizedText: itemText,
        sourceHeading: detectedHeadings.filter((entry) => entry.blockIndex < index).slice(-1)[0]?.rawHeading || null,
        sourceSectionType: currentSection,
        sourceLineStart: block.lineStart,
        sourceLineEnd: block.lineEnd,
        extractionMethod: 'heading_parser',
        confidence: 0.9,
      });
    });
  });

  return sections;
};
