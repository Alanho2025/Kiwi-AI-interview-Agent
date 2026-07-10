import { segmentBlockItems } from './utils/itemSegmentationUtils.js';

const APPLICATION_INSTRUCTION_PATTERN = /right to work|expected salary|notice are you required|medical check|drug screening|your application will include|apply online/i;

const createEmptySections = () => ({
  introduction: [],
  responsibilities: [],
  qualifications: [],
  niceToHaveRequirements: [],
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

  const appendSectionItem = (sectionName, block, itemText, sourceHeading) => {
    const items = sections[sectionName];
    const previousItem = items[items.length - 1];
    const shouldMergeWithPrevious = sectionName === 'applicationInstructions'
      && previousItem
      && previousItem.sourceLineEnd === block.lineStart - 1
      && !/[.!?:]$/.test(previousItem.text);

    if (shouldMergeWithPrevious) {
      previousItem.text = `${previousItem.text} ${itemText}`.trim();
      previousItem.normalizedText = previousItem.text;
      previousItem.sourceLineEnd = block.lineEnd;
      return;
    }

    items.push({
      id: `${sectionName}-${block.lineStart}-${items.length + 1}`,
      text: itemText,
      normalizedText: itemText,
      sourceHeading,
      sourceSectionType: sectionName,
      sourceLineStart: block.lineStart,
      sourceLineEnd: block.lineEnd,
      extractionMethod: 'heading_parser',
      confidence: 0.9,
    });
  };

const BOILERPLATE_ITEM_PATTERNS = [
  /^why\s+you\s+should\s+care:?$/i,
  /^why\s+work\s+for\s+us:?$/i,
  /^why\s+join\s+us!?$/i,
  /^what\s+we\s+offer:?$/i,
  /^how\s+to\s+apply:?$/i,
  /^about\s+the\s+company:?$/i,
  /^about\s+us:?$/i,
  /^apply\s+now:?$/i,
  /^recruiter:?$/i,
  /^save\s+job:?$/i,
  /^share\s+this\s+job:?$/i,
  /^work\s+type:?$/i,
  /^posted\s+date:?$/i,
  /^salary:?$/i,
  /^location:?$/i,
];

  blocks.forEach((block, index) => {
    const heading = headingMap.get(index);
    if (heading) {
      currentSection = heading.normalizedSectionType;
      return;
    }

    segmentBlockItems(block.text).forEach((itemText) => {
      if (BOILERPLATE_ITEM_PATTERNS.some((p) => p.test(itemText.trim()))) {
        return;
      }
      const resolvedSection = APPLICATION_INSTRUCTION_PATTERN.test(itemText) ? 'applicationInstructions' : currentSection;
      const sourceHeading = detectedHeadings.filter((entry) => entry.blockIndex < index).slice(-1)[0]?.rawHeading || null;
      appendSectionItem(resolvedSection, block, itemText, sourceHeading);
    });
  });

  return sections;
};
