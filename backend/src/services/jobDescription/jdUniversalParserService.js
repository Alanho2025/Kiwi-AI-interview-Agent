import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';
import { unique } from './jobDescriptionShared.js';

export const UNIVERSAL_REQUIREMENT_CATEGORIES = [
  'technical_skill',
  'tool_or_platform',
  'domain_knowledge',
  'qualification',
  'certification',
  'experience',
  'responsibility',
  'soft_skill',
  'communication',
  'leadership',
  'customer_or_stakeholder',
  'compliance_or_safety',
  'availability_or_location',
  'culture_fit',
  'nice_to_have',
];

const CATEGORY_BY_PATTERN = [
  [/certificat|licen[cs]e|registered|registration/i, 'certification'],
  [/degree|bachelor|master|qualification|diploma/i, 'qualification'],
  [/years?|professional|commercial|experience/i, 'experience'],
  [/aws|azure|gcp|salesforce|excel|sql|python|react|node|software|platform|tool/i, 'tool_or_platform'],
  [/safety|compliance|privacy|regulatory|legal|policy/i, 'compliance_or_safety'],
  [/customer|client|stakeholder|complaint|relationship/i, 'customer_or_stakeholder'],
  [/communicat|writing|present|report|documentation/i, 'communication'],
  [/lead|manage|mentor|supervis/i, 'leadership'],
  [/teamwork|adapt|culture|values/i, 'culture_fit'],
  [/responsib|coordinate|deliver|support|handle|maintain|prepare/i, 'responsibility'],
];

const inferCategory = (text = '', fallback = '') => {
  const normalizedFallback = UNIVERSAL_REQUIREMENT_CATEGORIES.includes(fallback) ? fallback : '';
  if (normalizedFallback) return normalizedFallback;
  const match = CATEGORY_BY_PATTERN.find(([pattern]) => pattern.test(text));
  return match?.[1] || 'soft_skill';
};

const inferIndustry = (rubric = {}, rawJD = '') => {
  const text = `${rubric.roleFamily || ''} ${rubric.title || ''} ${rawJD}`.toLowerCase();
  if (/health|nurse|clinic|patient|medical/.test(text)) return 'Healthcare';
  if (/teach|school|student|education|curriculum/.test(text)) return 'Education';
  if (/sales|account executive|business development/.test(text)) return 'Sales';
  if (/marketing|campaign|content|seo|brand/.test(text)) return 'Marketing';
  if (/finance|accounting|payroll|bookkeep/.test(text)) return 'Finance';
  if (/admin|reception|office coordinator/.test(text)) return 'Administration';
  if (/customer|support|service/.test(text)) return 'Customer service';
  if (/engineer|manufacturing|civil|mechanical/.test(text)) return 'Engineering';
  if (/data|analytics|machine learning|ai/.test(text)) return 'Data and AI';
  if (/software|developer|cloud|api|frontend|backend/.test(text)) return 'IT';
  return rubric.roleFamily || 'General';
};

const normalizeRequirement = (item = {}, index = 0) => {
  const text = String(item.text || item.label || item.normalizedCapability || '').trim();
  if (!text) return null;
  const category = inferCategory(text, item.category);
  const importance = ['high', 'medium', 'low'].includes(item.importance) ? item.importance : 'medium';
  return {
    id: item.id || `req_${index + 1}`,
    text,
    label: text,
    category,
    normalizedCapability: String(item.normalizedCapability || text).trim(),
    importance,
    mustHave: item.mustHave === undefined ? item.type === 'hard' || importance === 'high' : Boolean(item.mustHave),
    evidenceNeeded: String(item.evidenceNeeded || `The CV should show direct evidence for ${text}.`).trim(),
  };
};

const buildFallbackRequirements = (rubric = {}) => (rubric.requirements || [])
  .map((item, index) => normalizeRequirement({
    id: item.id || `req_${index + 1}`,
    text: item.label,
    category: item.category,
    importance: item.importance,
    mustHave: item.type === 'hard' || item.importance === 'high',
    evidenceNeeded: item.notes || '',
  }, index))
  .filter(Boolean);

const buildFallbackRoleProfile = ({ rawJD = '', rubric = {} } = {}) => {
  const requirements = buildFallbackRequirements(rubric);
  return {
    schemaVersion: 'universal_role_profile_v1',
    roleTitle: rubric.title || rubric.jobTitle || rubric.jobOverview?.title || 'Target Role',
    industry: inferIndustry(rubric, rawJD),
    seniority: rubric.roleLevel || 'unspecified',
    employmentType: rubric.jobOverview?.employmentType || '',
    requirements,
    assessmentFocus: unique([
      ...requirements.filter((item) => item.mustHave).slice(0, 4).map((item) => item.normalizedCapability),
      ...(rubric.interviewTargets?.technical || []),
      ...(rubric.interviewTargets?.behavioural || []),
    ]).slice(0, 8),
    parser: { provider: 'fallback_rubric', confidence: rubric.metadata?.confidence || 0.62 },
  };
};

const buildPrompt = ({ rawJD = '', fallbackProfile = {} }) => `Convert this job description into a universal role profile for CV-JD semantic matching.

Return strict JSON only with this shape:
{
  "roleTitle": "string",
  "industry": "IT | Data and AI | Marketing | Sales | Customer service | Administration | Healthcare | Education | Engineering | Operations | Finance | General",
  "seniority": "Entry-level | Junior | Mid-level | Senior | Lead | Manager | unspecified",
  "employmentType": "string",
  "requirements": [
    {
      "id": "req_1",
      "text": "single role requirement",
      "category": "${UNIVERSAL_REQUIREMENT_CATEGORIES.join(' | ')}",
      "normalizedCapability": "short capability label",
      "importance": "high | medium | low",
      "mustHave": true,
      "evidenceNeeded": "what the CV must show"
    }
  ],
  "assessmentFocus": ["string"]
}

Rules:
1. Support any job family, not only IT.
2. Keep each requirement atomic.
3. Do not invent legal, certification, location, or qualification requirements.
4. Mark nice-to-have items as mustHave=false and category="nice_to_have".
5. Evidence needed must describe observable CV proof.

Fallback parser profile for reference:
${JSON.stringify(fallbackProfile, null, 2).slice(0, 8000)}

Raw JD:
${String(rawJD || '').slice(0, 9000)}`;

export const buildUniversalRoleProfile = async ({ rawJD = '', rubric = {} } = {}) => {
  const fallbackProfile = buildFallbackRoleProfile({ rawJD, rubric });
  if (process.env.AI_TEST_MODE === 'mock' || process.env.MATCH_ENGINE !== 'semantic') {
    return fallbackProfile;
  }

  const parsed = await callDeepSeekJson({
    prompt: buildPrompt({ rawJD, fallbackProfile }),
    systemInstruction: 'You are a universal JD parser. Return valid JSON only. No prose.',
    fallback: fallbackProfile,
    maxRetries: 1,
    usageMetadata: { stage: 'jd_parse', feature: 'universal_jd_parser' },
  });

  const requirements = (Array.isArray(parsed.requirements) ? parsed.requirements : fallbackProfile.requirements)
    .map(normalizeRequirement)
    .filter(Boolean)
    .slice(0, 28);

  if (!requirements.length) return fallbackProfile;

  return {
    ...fallbackProfile,
    roleTitle: String(parsed.roleTitle || fallbackProfile.roleTitle).trim(),
    industry: String(parsed.industry || fallbackProfile.industry).trim(),
    seniority: String(parsed.seniority || fallbackProfile.seniority).trim(),
    employmentType: String(parsed.employmentType || fallbackProfile.employmentType).trim(),
    requirements,
    assessmentFocus: unique(Array.isArray(parsed.assessmentFocus) ? parsed.assessmentFocus : fallbackProfile.assessmentFocus)
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, 10),
    parser: {
      provider: parsed.error ? 'fallback_after_deepseek_error' : 'deepseek',
      confidence: parsed.error ? fallbackProfile.parser.confidence : 0.82,
      error: parsed.error,
    },
    requirementCategoryBreakdown: requirements.reduce((accumulator, item) => {
      accumulator[item.category] = (accumulator[item.category] || 0) + 1;
      return accumulator;
    }, {}),
    requirementIdsByLabel: Object.fromEntries(requirements.map((item) => [normalizeTaxonomyLabel(item.text), item.id])),
  };
};
