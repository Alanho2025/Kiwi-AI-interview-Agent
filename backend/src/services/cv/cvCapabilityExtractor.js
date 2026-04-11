import { inferCapabilitiesFromText } from '../match/capabilityTaxonomy.js';

export const extractCapabilities = ({ sectionTexts = [], skillLabels = [] } = {}) => {
  const fullText = [
    ...sectionTexts,
    ...skillLabels,
  ].join('\n');

  const functionalCapabilities = inferCapabilitiesFromText(fullText);
  const behaviouralCapabilities = functionalCapabilities.filter((item) => ['stakeholder_collaboration', 'documentation', 'mentoring', 'adaptability', 'ownership'].includes(item));

  return {
    functionalCapabilities,
    behaviouralCapabilities,
  };
};
