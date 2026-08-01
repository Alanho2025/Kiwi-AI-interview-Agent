import { normalizeText, tokenize, tokenSet, unique } from './matchShared.js';

const SECTION_WEIGHTS_BY_KIND = {
  technical: {
    experience: 1.3,
    projects: 1.2,
    skills: 1.0,
    personalStatement: 0.7,
    education: 0.75,
  },
  behavioural: {
    experience: 1.3,
    keyCompetencies: 1.2,
    projects: 0.9,
    volunteer: 0.9,
    personalStatement: 0.85,
  },
  role_fit: {
    experience: 1.2,
    personalStatement: 1.1,
    projects: 1.0,
    education: 0.9,
  },
};

const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'to', 'of', 'in', 'on', 'for', 'with', 'using', 'used', 'by', 'your', 'their', 'our',
  'good', 'strong', 'ability', 'recent', 'tertiary', 'qualification', 'requirements', 'requirement', 'core', 'bonus',
  'what', 'will', 'be', 'is', 'are', 'from', 'as', 'at', 'this', 'that', 'these', 'those', 'into', 'within', 'across',
  'clear', 'clearly', 'experience', 'foundations', 'support', 'work', 'working', 'build', 'enhance'
]);
const LOW_VALUE_OVERLAP_TOKENS = new Set([
  'ai',
  'business',
  'developer',
  'development',
  'engineer',
  'engineering',
  'focused',
  'off',
  'product',
  'quality',
  'software',
  'team',
  'teams',
  'tools',
  'value',
  'workflow',
  'workflows',
]);

const STRICT_TECH_PATTERNS = {
  aws: /\b(aws|amazon web services|ec2|lambda|s3|rds|ecs|eks|cloudwatch|iam)\b/i,
  azure: /\bazure\b/i,
  gcp: /\b(gcp|google cloud)\b/i,
  redis: /\bredis\b/i,
  elasticsearch: /\belasticsearch\b/i,
  kafka: /\b(kafka|distributed queue|distributed queueing|message queue|event streaming)\b/i,
  sql: /\b(sql|structured query language|postgresql|postgres|mysql|database query|query writing)\b/i,
  python: /\bpython\b/i,
  postgres: /\b(postgresql|postgres)\b/i,
  typescript: /\btypescript\b/i,
  javascript: /\b(javascript|js)\b/i,
  nextjs: /\b(next\.js|nextjs)\b/i,
  vue: /\b(vue|vue\.js)\b/i,
  react: /\breact\b/i,
  node: /\b(node\.js|nodejs|node)\b/i,
  express: /\bexpress\b/i,
  docker: /\b(docker|container|containerised|containerized)\b/i,
  kubernetes: /\b(kubernetes|k8s)\b/i,
  java: /\bjava\b/i,
  csharp: /\b(c#|c sharp|\.net|dotnet)\b/i,
  terraform: /\bterraform\b/i,
  ansible: /\bansible\b/i,
  graphql: /\bgraphql\b/i,
  figma: /\bfigma\b/i,
  git: /\b(git|github|gitlab)\b/i,
  cicd: /\b(ci\/cd|cicd|continuous integration)\b/i,
  powerbi: /\b(power bi|powerbi)\b/i,
  tableau: /\btableau\b/i,
  snowflake: /\bsnowflake\b/i,
  pytorch: /\bpytorch\b/i,
  tensorflow: /\btensorflow\b/i,
  llm: /\b(llm|large language model|rag|retrieval augmented generation|openai|vector search)\b/i,
};

const CLOUD_NATIVE_PATTERN = /\b(cloud-native|cloud native|kubernetes|k8s|docker|container|containerised|containerized|aws|azure|gcp|serverless|lambda|ecs|eks|ci\/cd|pipeline)\b/i;

const isQualificationRequirement = (label = '') =>
  /qualification|degree|bachelor|master|diploma|tertiary|computer science|software engineering|information technology/i.test(label);

const getStrictTechKeys = (label = '') => {
  const normalized = String(label || '').toLowerCase();
  const keys = [];
  for (const [key, pattern] of Object.entries(STRICT_TECH_PATTERNS)) {
    if (pattern.test(normalized)) keys.push(key);
  }
  if (/cloud-native|cloud native/i.test(normalized)) keys.push('cloud_native');
  return [...new Set(keys)];
};

const hasStrictTechEvidence = (label = '', text = '') => {
  const keys = getStrictTechKeys(label);
  if (!keys.length) return true;
  const evidenceText = String(text || '');
  // For disjunctive requirements or composite lists, satisfying ANY matching key is sufficient
  return keys.some((key) => {
    if (key === 'cloud_native') return CLOUD_NATIVE_PATTERN.test(evidenceText);
    return STRICT_TECH_PATTERNS[key]?.test(evidenceText);
  });
};

const LABEL_ALIASES = {
  'cloud infrastructure': ['cloud platform', 'azure infrastructure', 'platform reliability', 'platform', 'cloud environments', 'aws', 'azure', 'gcp'],
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
  sql: ['postgresql', 'postgres', 'mysql', 'database query', 'query writing'],
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

const directMatchScore = (label, text) => {
  const expandedLabel = expandAliases(label);
  const expandedText = expandAliases(text);
  const labelTokens = cleanTokens(expandedLabel);
  const textTokens = tokenSet(expandedText);
  const overlap = labelTokens.filter((token) => textTokens.has(token));
  
  if (
    labelTokens.length >= 1
    && overlap.length > 0
    && overlap.length <= 5
    && overlap.every((token) => LOW_VALUE_OVERLAP_TOKENS.has(token))
  ) {
    return { direct: false, overlap: [], ratio: 0, phraseBoost: 0 };
  }

  const ratio = labelTokens.length ? overlap.length / labelTokens.length : 0;
  // If ratio >= 0.35 or overlap has 2+ non-low-value tokens, consider direct match
  const direct = ratio >= 0.35 || overlap.length >= 2 || hasStrictTechEvidence(label, text);
  const phraseBoost = overlap.length >= 2 ? 0.35 : overlap.length === 1 ? 0.15 : 0;
  return { direct, overlap, ratio, phraseBoost };
};

export const computeSectionAwareMatch = ({ label, criterionType = 'micro', evidenceProfile = {} }) => {
  const kind = inferMatchKind(label, criterionType);
  const serialized = serializeSections(evidenceProfile);
  const sectionWeights = SECTION_WEIGHTS_BY_KIND[kind] || SECTION_WEIGHTS_BY_KIND.technical;

  let bestSection = 'experience';
  let bestScore = 0;
  let bestOverlap = [];
  let bestDirect = false;

  const sectionPriority = { experience: 3, projects: 2, keyCompetencies: 2, skills: 1, personalStatement: 1, education: 1, volunteer: 1 };

  for (const [sectionName, text] of Object.entries(serialized)) {
    if (!text) continue;
    if (sectionName === 'education' && !isQualificationRequirement(label)) continue;
    if (!hasStrictTechEvidence(label, text)) continue;

    const { direct, overlap, ratio, phraseBoost } = directMatchScore(label, text);
    const weight = sectionWeights[sectionName] || 1;
    const weightedScore = ((direct ? 1.05 : 0) + ratio + phraseBoost) * weight;

    const currentPriority = sectionPriority[sectionName] || 1;
    const bestPriority = sectionPriority[bestSection] || 1;

    // Prefer experience/projects over plain skills section when both have direct match
    if (
      weightedScore > bestScore ||
      (direct && !bestDirect) ||
      (direct && bestDirect && currentPriority > bestPriority && weightedScore >= bestScore * 0.85)
    ) {
      bestScore = weightedScore;
      bestSection = sectionName;
      bestOverlap = overlap;
      bestDirect = direct;
    }
  }

  let status = 'not_met';
  if (bestDirect || bestScore >= 1.25) status = 'met';
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
