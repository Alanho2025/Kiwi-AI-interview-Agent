import { buildTaxonomyItem } from '../taxonomyService.js';

const containsAny = (text = '', patterns = []) => patterns.some((pattern) => pattern.test(text));
const NICE_TO_HAVE_PATTERNS = [/\bbonus\b/i, /\bnice to have\b/i, /\bnice-to-have\b/i, /\bpreferred\b/i, /\bdesirable\b/i, /\badvantage(?:ous)?\b/i, /\bwould be advantageous\b/i, /\bpluses?\b/i];
const NICE_TO_HAVE_HEADING_PATTERNS = [/\bbonus\b/i, /\bnice to have\b/i, /\bnice-to-have\b/i, /\bpreferred\b/i, /\bdesirable\b/i, /\badvantage(?:ous)?\b/i, /\bpluses?\b/i];
const MUST_HAVE_PATTERNS = [/\bmust\b/i, /\bstrong\b/i, /\bexperience\b/i, /\bability to\b/i, /\bproficiency\b/i, /\bsolid foundation\b/i, /\bminimum\b/i, /\bdegree\b/i, /\bbasic experience\b/i, /\bcomfortable working\b/i];
const MUST_HAVE_HEADING_PATTERNS = [/we are seeking someone with/i, /what we'?re looking for/i, /what we are looking for/i, /requirements/i, /you'?ll need/i, /key requirements/i, /about you/i, /qualifications/i, /experience level/i, /stack/i, /tech stack/i];
const APPLICATION_PATTERNS = [
  /right to work/i,
  /expected salary/i,
  /notice are you required/i,
  /medical check/i,
  /drug screening/i,
  /apply online/i,
  /in return,\s*you'?ll get/i,
  /be part of our journey/i,
  /make sustainable living/i,
  /apply now and make an impact/i,
  /opportunity to learn from passionate/i,
];
const HEADING_ONLY_PATTERN = /^(stack|tech stack|technology stack|tools|technologies|experience level|level|seniority|bonus|bonus requirements|nice[- ]?to[- ]?haves?|what we'?re looking for|what we are looking for|what you'?ll do|what you will do|responsibilities|roles?\s*(?:&|and)\s*responsibilities|requirements|qualifications|core requirements|skills\s*(?:&|and)\s*experience)$/i;
const FALLBACK_REQUIREMENT_PATTERNS = [
  /\b\d+\+?\s*years?\b/i,
  /\bbachelor'?s\b/i,
  /\bdegree\b/i,
  /\bqualification\b/i,
  /\bexperience\b/i,
  /\bproficiency\b/i,
  /\bstrong\b/i,
  /\bsolid foundation\b/i,
  /\bability to\b/i,
  /\bknowledge of\b/i,
  /\bfamiliarity with\b/i,
  /\bcomfortable working\b/i,
  /\bpython\b/i,
  /\bsql\b/i,
  /\breact\b/i,
  /\btypescript\b/i,
  /\bjavascript\b/i,
  /\bc#\b/i,
  /\.net\b/i,
  /\baws\b/i,
  /\bazure\b/i,
  /\bsnowflake\b/i,
  /\bdbt\b/i,
  /\bpower\s?bi\b/i,
  /\bpower query\b/i,
  /\bexcel\b/i,
  /\brest(?:ful)? api/i,
  /\boauth\b/i,
  /\bdocker\b/i,
  /\bcloud\b/i,
  /\bgpu\b/i,
  /\brunpod\b/i,
  /\bcomfyui\b/i,
  /\bcommunication skills?\b/i,
  /\bproblem[- ]solving\b/i,
  /\bstakeholder\b/i,
];

const cleanRequirementText = (value = '') => String(value || '')
  .replace(/\bExperience\s+with\s+our\s+game,\s*/i, 'Experience with ')
  .replace(/\bPath of Exile,\s+or\s+similar\s+games\b/i, 'Path of Exile or similar games')
  .replace(/\s+/g, ' ')
  .trim();

const createRequirementItem = (item, type, importance = 'medium', evidenceType = 'explicit') => {
  const text = cleanRequirementText(item.text);
  const normalizedText = cleanRequirementText(item.normalizedText || item.text);

  return {
  id: buildTaxonomyItem(normalizedText || text).id,
  text,
  normalizedText: normalizedText || text,
  label: normalizedText || text,
  type,
  importance,
  evidenceType,
  sourceHeading: item.sourceHeading,
  sourceSectionType: item.sourceSectionType,
  extractionMethod: item.extractionMethod,
  confidence: item.confidence,
  sourceLineStart: item.sourceLineStart,
  sourceLineEnd: item.sourceLineEnd,
  sourceText: item.text,
};
};

const uniqueByText = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const key = (item.normalizedText || item.text || item.label || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const isHeadingOnly = (item = {}) => HEADING_ONLY_PATTERN.test(String(item.text || item.label || '').trim());
const isApplication = (item = {}) => containsAny(item.text || '', APPLICATION_PATTERNS) || containsAny(item.sourceHeading || '', APPLICATION_PATTERNS);

const collectFallbackRequirementItems = (sections = {}) => {
  const candidates = [
    ...(sections.introduction || []),
    ...(sections.companyContext || []),
    ...(sections.responsibilities || []),
  ];

  return uniqueByText(
    candidates
      .filter((item) => {
        const text = item?.text || '';
        const headingText = item?.sourceHeading || '';
        if (!text.trim() || isHeadingOnly(item)) return false;
        if (containsAny(text, APPLICATION_PATTERNS) || containsAny(headingText, APPLICATION_PATTERNS)) return false;
        return containsAny(text, FALLBACK_REQUIREMENT_PATTERNS) || containsAny(headingText, FALLBACK_REQUIREMENT_PATTERNS);
      })
      .map((item) => createRequirementItem(item, 'must_have', 'low', 'fallback')),
  );
};

export const classifyJobDescriptionRequirements = (sections = {}) => {
  const responsibilities = uniqueByText(
    (sections.responsibilities || [])
      .filter((item) => !isHeadingOnly(item) && !isApplication(item))
      .map((item) => createRequirementItem(item, 'responsibility', 'high')),
  );

  const mustSourceItems = uniqueByText([...(sections.qualifications || []), ...(sections.softSkillPersona || [])])
    .filter((item) => !isHeadingOnly(item) && !isApplication(item));
  const niceSourceItems = uniqueByText(sections.niceToHaveRequirements || [])
    .filter((item) => !isHeadingOnly(item) && !isApplication(item));

  const mustHaveRequirements = [];
  const niceToHaveRequirements = [];
  const qualifications = [];
  const softSkillItems = [];

  niceSourceItems.forEach((item) => {
    niceToHaveRequirements.push(createRequirementItem(item, 'nice_to_have', 'low'));
  });

  mustSourceItems.forEach((item) => {
    const text = item.text || '';
    const headingText = item.sourceHeading || '';

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
    if (containsAny(headingText, NICE_TO_HAVE_HEADING_PATTERNS)) {
      niceToHaveRequirements.push(createRequirementItem(item, 'nice_to_have', 'low'));
      return;
    }
    if (containsAny(headingText, MUST_HAVE_HEADING_PATTERNS)) {
      mustHaveRequirements.push(createRequirementItem(item, 'must_have', 'high'));
      return;
    }
    if (containsAny(text, NICE_TO_HAVE_PATTERNS)) {
      niceToHaveRequirements.push(createRequirementItem(item, 'nice_to_have', 'low'));
      return;
    }
    if (containsAny(text, MUST_HAVE_PATTERNS) || mustSourceItems.length <= 10) {
      mustHaveRequirements.push(createRequirementItem(item, 'must_have', 'high'));
    }
  });

  if (mustHaveRequirements.length < 2) {
    collectFallbackRequirementItems(sections).forEach((item) => {
      mustHaveRequirements.push(item);
      qualifications.push(createRequirementItem(item, 'qualification', 'low', 'fallback'));
    });
  }

  return {
    responsibilities,
    qualifications: uniqueByText(qualifications),
    mustHaveRequirements: uniqueByText(mustHaveRequirements),
    niceToHaveRequirements: uniqueByText(niceToHaveRequirements),
    softSkillSignals: uniqueByText(softSkillItems),
  };
};
