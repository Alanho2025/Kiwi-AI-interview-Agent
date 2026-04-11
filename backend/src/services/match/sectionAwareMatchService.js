import { normalizeText, tokenize, tokenSet, unique } from './matchShared.js';

const SECTION_WEIGHTS_BY_KIND = {
  technical: {
    projects: 1.2,
    skills: 1.1,
    experience: 1,
    personalStatement: 0.6,
    education: 0.7,
  },
  behavioural: {
    keyCompetencies: 1.2,
    experience: 1,
    volunteer: 0.9,
    personalStatement: 0.6,
  },
  role_fit: {
    personalStatement: 1.2,
    projects: 1,
    education: 0.8,
    experience: 0.7,
  },
};

export const inferMatchKind = (label = '', criterionType = 'micro') => {
  const text = String(label || '').toLowerCase();
  if (/(communication|team|collaboration|stakeholder|adaptability|documentation|mentor|lead)/i.test(text)) return 'behavioural';
  if (criterionType === 'macro' && /(experience|motivation|fit|ownership|delivery)/i.test(text)) return 'role_fit';
  return 'technical';
};

const serializeSections = (evidenceProfile = {}) => {
  const sections = evidenceProfile.sections || {};
  return {
    personalStatement: sections.personalStatement || '',
    keyCompetencies: (sections.keyCompetencies || []).join('\n'),
    experience: (sections.experience || []).join('\n'),
    projects: (sections.projects || []).map((item) => [item.title, item.techStack?.join(' '), item.responsibilities?.join(' '), item.outcomes?.join(' ')].join(' ')).join('\n'),
    education: (sections.education || []).join('\n'),
    volunteer: (sections.volunteer || []).join('\n'),
    skills: (sections.skills || []).join(' '),
  };
};

const directMatchScore = (label, text) => {
  const normalizedLabel = normalizeText(label);
  const normalizedTextValue = normalizeText(text);
  const labelTokens = unique(tokenize(normalizedLabel));
  const textTokens = tokenSet(normalizedTextValue);
  const direct = normalizedLabel.length > 2 && normalizedTextValue.includes(normalizedLabel);
  const overlap = labelTokens.filter((token) => textTokens.has(token));
  const ratio = labelTokens.length ? overlap.length / labelTokens.length : 0;
  return { direct, overlap, ratio };
};

export const computeSectionAwareMatch = ({ label, criterionType = 'micro', evidenceProfile = {} }) => {
  const kind = inferMatchKind(label, criterionType);
  const serialized = serializeSections(evidenceProfile);
  const sectionWeights = SECTION_WEIGHTS_BY_KIND[kind] || SECTION_WEIGHTS_BY_KIND.technical;

  let bestSection = 'experience';
  let bestScore = 0;
  let bestOverlap = [];

  for (const [sectionKey, text] of Object.entries(serialized)) {
    if (!text) continue;
    const weight = sectionWeights[sectionKey] ?? 0.5;
    const { direct, overlap, ratio } = directMatchScore(label, text);
    const score = ((direct ? 1 : 0) + ratio) * weight;
    if (score > bestScore) {
      bestScore = score;
      bestSection = sectionKey;
      bestOverlap = overlap;
    }
  }

  let status = 'not_met';
  if (bestScore >= 1.35) status = 'met';
  else if (bestScore >= 0.8) status = 'partial';
  else if (bestScore > 0.2) status = 'inferred';

  return {
    status,
    scoreSignal: bestScore,
    matchedSection: bestSection,
    overlap: bestOverlap,
    evidence: bestOverlap.length ? [`Matched in ${bestSection}: ${bestOverlap.join(', ')}`] : bestScore > 0.2 ? [`Weak evidence from ${bestSection}`] : [],
  };
};
