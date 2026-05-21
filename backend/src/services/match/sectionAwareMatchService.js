import { normalizeText, tokenize, tokenSet, unique } from './matchShared.js';

const SECTION_WEIGHTS_BY_KIND = {
  technical: {
    projects: 1.2,
    skills: 1.15,
    experience: 1,
    personalStatement: 0.7,
    education: 0.75,
  },
  behavioural: {
    keyCompetencies: 1.2,
    experience: 1.05,
    volunteer: 0.9,
    personalStatement: 0.85,
    projects: 0.9,
  },
  role_fit: {
    personalStatement: 1.2,
    projects: 1,
    education: 1.1,
    experience: 0.9,
  },
};

const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'using', 'used', 'by', 'your', 'their', 'our',
  'good', 'strong', 'ability', 'recent', 'tertiary', 'qualification', 'requirements', 'requirement', 'core', 'bonus',
  'what', 'will', 'be', 'is', 'are', 'from', 'as', 'at', 'this', 'that', 'these', 'those', 'into', 'within', 'across',
  'clear', 'clearly', 'experience', 'foundations', 'support', 'work', 'working', 'build', 'enhance'
]);

const LABEL_ALIASES = {
  'cloud infrastructure': ['cloud platform', 'azure infrastructure', 'platform reliability', 'platform', 'cloud environments'],
  docker: ['container', 'containers', 'containerized', 'containerisation', 'docker-based'],
  kubernetes: ['k8s', 'kubernetes'],
  documentation: ['documented', 'runbook', 'runbooks', 'technical documentation', 'knowledge base', 'operational documentation'],
  deployment: ['deployed', 'deployment', 'deployments', 'release', 'release steps', 'rollout', 'rollout consistency', 'delivery pipeline', 'pipelines'],
  'ci/cd': ['pipeline', 'pipelines', 'build and release', 'continuous integration', 'continuous delivery'],
  communication: ['communicator', 'communicate', 'communicated', 'presented', 'status updates', 'stakeholder', 'stakeholders', 'cross-functional'],
  ownership: ['owned', 'owning', 'took responsibility', 'responsible', 'end-to-end'],
  troubleshooting: ['troubleshot', 'incident', 'incidents', 'issue resolution', 'root cause', 'debugging'],
  'learn quickly': ['learning new technologies quickly', 'learning quickly', 'learn new technologies quickly', 'adapted quickly', 'new tools'],
  'software engineering': ['software developer', 'software development', 'engineering'],
  'computer science': ['software engineering', 'information technology', 'information systems'],
  'tertiary qualification': ['bachelor', 'master', 'degree', 'university'],
  'api development': ['rest endpoints', 'rest api', 'rest apis', 'api endpoints', 'backend endpoints'],
};

export const inferMatchKind = (label = '', criterionType = 'micro') => {
  const text = String(label || '').toLowerCase();
  if (/(communication|team|collaboration|stakeholder|adaptability|documentation|mentor|lead|ownership|learn quickly)/i.test(text)) return 'behavioural';
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

const expandAliases = (value = '') => {
  const lowered = normalizeText(value);
  const additions = [];
  for (const [label, aliases] of Object.entries(LABEL_ALIASES)) {
    if (lowered.includes(label) || aliases.some((alias) => lowered.includes(alias))) {
      additions.push(label, ...aliases);
    }
  }
  return unique([lowered, ...additions.map((item) => normalizeText(item))]).join(' ');
};

const cleanTokens = (text = '') => unique(tokenize(text).filter((token) => token.length > 1 && !STOPWORDS.has(token)));

const detectEducationSignal = (label = '', text = '') => {
  const normalizedLabel = normalizeText(label);
  const normalizedTextValue = normalizeText(text);
  if (!/qualification|computer science|software engineering|degree|bachelor|master/i.test(normalizedLabel)) return false;
  return /(bachelor|master|degree|university|institute|computer science|software engineering|information technology)/i.test(normalizedTextValue);
};

const directMatchScore = (label, text) => {
  const expandedLabel = expandAliases(label);
  const expandedText = expandAliases(text);
  const labelTokens = cleanTokens(expandedLabel);
  const textTokens = tokenSet(expandedText);
  const direct = labelTokens.length > 0 && labelTokens.every((token) => textTokens.has(token));
  const overlap = labelTokens.filter((token) => textTokens.has(token));
  const ratio = labelTokens.length ? overlap.length / labelTokens.length : 0;
  const phraseBoost = overlap.length >= 2 ? 0.22 : overlap.length === 1 ? 0.08 : 0;
  return { direct, overlap, ratio, phraseBoost };
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
    const { direct, overlap, ratio, phraseBoost } = directMatchScore(label, text);
    const educationBoost = sectionKey === 'education' && detectEducationSignal(label, text) ? 0.95 : 0;
    const score = ((direct ? 1.05 : 0) + ratio + phraseBoost + educationBoost) * weight;
    if (score > bestScore) {
      bestScore = score;
      bestSection = sectionKey;
      bestOverlap = overlap;
    }
  }

  let status = 'not_met';
  if (bestScore >= 1.25) status = 'met';
  else if (bestScore >= 0.72) status = 'partial';
  else if (bestScore > 0.24) status = 'inferred';

  const evidence = bestOverlap.length
    ? [`Matched in ${bestSection}: ${bestOverlap.join(', ')}`]
    : bestScore > 0.24
      ? [`Weak evidence from ${bestSection}`]
      : [];

  return {
    status,
    scoreSignal: bestScore,
    matchedSection: bestSection,
    overlap: bestOverlap,
    evidence,
  };
};
