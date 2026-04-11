import { buildTaxonomyItem } from '../taxonomyService.js';

const containsAny = (text = '', patterns = []) => patterns.some((pattern) => pattern.test(text));

const NICE_TO_HAVE_PATTERNS = [/\bbonus\b/i, /\bnice to have\b/i, /\bpreferred\b/i, /\bdesirable\b/i, /\bfamiliarity with\b/i];
const MUST_HAVE_PATTERNS = [/\brecent tertiary qualification\b/i, /\bstrong university results\b/i, /\bhands-on experience\b/i, /\bfoundations in\b/i, /\bexposure to\b/i, /\bcomfortable communicating\b/i, /\bability to\b/i];

const createRequirementItem = (item, type, importance = 'medium', evidenceType = 'explicit') => ({
  id: buildTaxonomyItem(item.normalizedText || item.text).id,
  text: item.text,
  normalizedText: item.normalizedText || item.text,
  label: item.normalizedText || item.text,
  type,
  importance,
  evidenceType,
  sourceHeading: item.sourceHeading,
  sourceSectionType: item.sourceSectionType,
  extractionMethod: item.extractionMethod,
  confidence: item.confidence,
  sourceLineStart: item.sourceLineStart,
  sourceLineEnd: item.sourceLineEnd,
});

const uniqueByText = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = (item.normalizedText || item.text || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const classifyJobDescriptionRequirements = (sections = {}) => {
  const responsibilities = uniqueByText((sections.responsibilities || []).map((item) => createRequirementItem(item, 'responsibility', 'high')));
  const qualificationItems = uniqueByText(sections.qualifications || []);
  const personaItems = uniqueByText(sections.softSkillPersona || []);

  const mustHaveRequirements = [];
  const niceToHaveRequirements = [];
  const qualifications = [];
  const softSkillItems = [];

  qualificationItems.forEach((item) => {
    const text = item.text || '';
    qualifications.push(createRequirementItem(item, 'qualification', 'medium'));
    if (containsAny(text, NICE_TO_HAVE_PATTERNS)) {
      niceToHaveRequirements.push(createRequirementItem(item, 'nice_to_have', 'low'));
      return;
    }
    if (containsAny(text, MUST_HAVE_PATTERNS) || qualificationItems.length <= 8) {
      mustHaveRequirements.push(createRequirementItem(item, 'must_have', 'high'));
    }
  });

  personaItems.forEach((item) => {
    softSkillItems.push({
      name: item.text,
      label: item.text,
      category: 'soft',
      sourceHeading: item.sourceHeading,
      sourceSectionType: item.sourceSectionType,
      extractionMethod: item.extractionMethod,
      confidence: item.confidence,
      sourceLineStart: item.sourceLineStart,
      sourceLineEnd: item.sourceLineEnd,
    });
  });

  return {
    responsibilities,
    qualifications: uniqueByText(qualifications),
    mustHaveRequirements: uniqueByText(mustHaveRequirements),
    niceToHaveRequirements: uniqueByText(niceToHaveRequirements),
    softSkillSignals: uniqueByText(softSkillItems),
  };
};
