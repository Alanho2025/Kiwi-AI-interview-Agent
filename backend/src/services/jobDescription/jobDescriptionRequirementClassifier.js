import { buildTaxonomyItem } from '../taxonomyService.js';

const containsAny = (text = '', patterns = []) => patterns.some((pattern) => pattern.test(text));
const NICE_TO_HAVE_PATTERNS = [/\bbonus\b/i, /\bnice to have\b/i, /\bpreferred\b/i, /\bdesirable\b/i, /\badvantage(?:ous)?\b/i, /\bfamiliarity with\b/i, /\bwould be advantageous\b/i];
const MUST_HAVE_PATTERNS = [/\bmust\b/i, /\bstrong\b/i, /\bexperience\b/i, /\bability to\b/i, /\bproficiency\b/i, /\bsolid foundation\b/i, /\bminimum\b/i, /\bdegree\b/i];
const APPLICATION_PATTERNS = [/right to work/i, /expected salary/i, /notice are you required/i, /medical check/i, /drug screening/i, /apply online/i];

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
    const key = (item.normalizedText || item.text || item.label || '').toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const classifyJobDescriptionRequirements = (sections = {}) => {
  const responsibilities = uniqueByText((sections.responsibilities || []).map((item) => createRequirementItem(item, 'responsibility', 'high')));
  const qualificationItems = uniqueByText([...(sections.qualifications || []), ...(sections.softSkillPersona || [])].filter((item) => !containsAny(item.text || '', APPLICATION_PATTERNS)));

  const mustHaveRequirements = [];
  const niceToHaveRequirements = [];
  const qualifications = [];
  const softSkillItems = [];

  qualificationItems.forEach((item) => {
    const text = item.text || '';
    const headingText = item.sourceHeading || '';
    if (containsAny(text, APPLICATION_PATTERNS) || containsAny(headingText, APPLICATION_PATTERNS)) return;

    if (/communication|collaborative|curious|organised|organized|adaptable|problem solver|ownership|team/i.test(text)) {
      softSkillItems.push({
        name: text,
        label: text,
        category: 'soft',
        sourceHeading: item.sourceHeading,
        sourceSectionType: item.sourceSectionType,
        extractionMethod: item.extractionMethod,
        confidence: item.confidence,
        sourceLineStart: item.sourceLineStart,
        sourceLineEnd: item.sourceLineEnd,
      });
    }

    qualifications.push(createRequirementItem(item, 'qualification', 'medium'));
    if (containsAny(headingText, NICE_TO_HAVE_PATTERNS) || containsAny(text, NICE_TO_HAVE_PATTERNS)) {
      niceToHaveRequirements.push(createRequirementItem(item, 'nice_to_have', 'low'));
      return;
    }
    if (containsAny(headingText, MUST_HAVE_PATTERNS) || containsAny(text, MUST_HAVE_PATTERNS) || qualificationItems.length <= 10) {
      mustHaveRequirements.push(createRequirementItem(item, 'must_have', 'high'));
    }
  });

  return {
    responsibilities,
    qualifications: uniqueByText(qualifications),
    mustHaveRequirements: uniqueByText(mustHaveRequirements),
    niceToHaveRequirements: uniqueByText(niceToHaveRequirements),
    softSkillSignals: uniqueByText(softSkillItems),
  };
};
