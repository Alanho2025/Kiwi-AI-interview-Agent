import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';
import { unique } from './jobDescriptionShared.js';

export const ROLE_DOMAINS = [
  'software_it',
  'data_ai',
  'ai_automation_operations',
  'business_operations',
  'sales_customer',
  'marketing_content',
  'admin_coordination',
  'engineering_field',
  'healthcare',
  'education',
  'finance',
  'general_graduate',
  'general',
  'unknown',
];

export const UNIVERSAL_REQUIREMENT_CATEGORIES = [
  'technical_skill',
  'tool_or_platform',
  'domain_knowledge',
  'ai_tool_fluency',
  'workflow_automation',
  'process_improvement',
  'reporting_dashboard',
  'learning_agility',
  'creativity_or_ideas',
  'motivation_or_attitude',
  'productivity_tool',
  'cross_functional_coordination',
  'basic_integration',
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
  'company_context',
];

const HARD_BLOCKER_CATEGORIES = new Set([
  'qualification',
  'certification',
  'compliance_or_safety',
  'availability_or_location',
]);

const NON_BLOCKER_HIGH_IMPORTANCE_CATEGORIES = new Set([
  'learning_agility',
  'creativity_or_ideas',
  'motivation_or_attitude',
  'culture_fit',
  'soft_skill',
  'communication',
]);

const CATEGORY_BY_PATTERN = [
  [/certificat|licen[cs]e|registered|registration/i, 'certification'],
  [/degree|bachelor|master|qualification|diploma/i, 'qualification'],
  [/chatgpt|claude|generative ai|ai tools?|large language model|llm/i, 'ai_tool_fluency'],
  [/workflow automation|automate workflows?|automation tools?|zapier|make\.com|integromat|power automate/i, 'workflow_automation'],
  [/process improvement|improve processes|streamline|efficiency|work smarter|smarter systems|operational improvement/i, 'process_improvement'],
  [/reporting|dashboard|analytics|insights|data visuali[sz]ation|spreadsheet/i, 'reporting_dashboard'],
  [/google workspace|google docs|google sheets|microsoft office|excel|productivity tools?/i, 'productivity_tool'],
  [/api integration|integrations?|basic coding|scripting|webhook/i, 'basic_integration'],
  [/curious|experiment|learn quickly|learning|trial new|research new tools?/i, 'learning_agility'],
  [/full of ideas|new ideas|creative|innovation|innovative|ideas/i, 'creativity_or_ideas'],
  [/motivated|energetic|proactive|passion|driven|initiative/i, 'motivation_or_attitude'],
  [/cross[-\s]?functional|across teams|departments|coordinate|collaborat|support teams/i, 'cross_functional_coordination'],
  [/years?|professional|commercial|experience/i, 'experience'],
  [/aws|azure|gcp|redis|elasticsearch|kafka|queue|salesforce|sql|python|typescript|next\.js|vue|react|node|software|platform/i, 'tool_or_platform'],
  [/safety|compliance|privacy|regulatory|legal|policy/i, 'compliance_or_safety'],
  [/customer|client|stakeholder|complaint|relationship/i, 'customer_or_stakeholder'],
  [/communicat|writing|present|documentation/i, 'communication'],
  [/lead|manage|mentor|supervis/i, 'leadership'],
  [/teamwork|adapt|culture|values/i, 'culture_fit'],
  [/responsib|deliver|support|handle|maintain|prepare/i, 'responsibility'],
];

const JD_SECTION_HEADING_PATTERN = /^(about the hiring team|about the team|about the role|what the role entails|responsibilities|requirements|qualifications|preferred qualifications|nice to have|bonus if you have experience with|benefits|why img|why us|business unit|company overview|about us|hiring team|role entails)$/i;
const COMPANY_CONTEXT_PATTERN = /\b(this organisation|this organization|we are|we're|our company|our team|business unit|hiring team|about the hiring team|about us|well-established|one stop shop|across heavy diesel|growing business|auckland based technology business|investing heavily|strong engineering and product focus)\b/i;
const CANDIDATE_REQUIREMENT_PATTERN = /\b(you will|you'll|you are|you have|you bring|you can|you should|candidate|engineer who|engineers who|looking for|must|required|responsible for|experience with|strong experience|ability to|proficient|familiar|knowledge of|what we're looking for)\b/i;

const isCompanyContextRequirement = (text = '', category = '') => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (category === 'company_context') return true;
  if (!COMPANY_CONTEXT_PATTERN.test(normalized)) return false;
  return !CANDIDATE_REQUIREMENT_PATTERN.test(normalized);
};

const cleanEvidenceNeeded = (value = '', requirementText = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || JD_SECTION_HEADING_PATTERN.test(text)) {
    return `The CV should show direct evidence for ${requirementText}.`;
  }
  return text;
};

const inferCategory = (text = '', fallback = '') => {
  const normalizedFallback = UNIVERSAL_REQUIREMENT_CATEGORIES.includes(fallback) ? fallback : '';
  if (normalizedFallback) return normalizedFallback;
  if (isCompanyContextRequirement(text)) return 'company_context';
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
  if (/heavy diesel|hydraulic|machining|fabrication|field service|electrical|electronic engineering|manufacturing|civil|mechanical/.test(text)) return 'Engineering';
  if (/workflow automation|ai automation|automation coordinator|chatgpt|claude|work smarter|process improvement/.test(text)) return 'Operations';
  if (/data|analytics|machine learning|ai/.test(text)) return 'Data and AI';
  if (/software|developer|cloud|api|frontend|backend/.test(text)) return 'IT';
  return rubric.roleFamily || 'General';
};

const inferRoleDomain = ({ rubric = {}, rawJD = '', industry = '' } = {}) => {
  const text = `${rubric.roleFamily || ''} ${rubric.title || ''} ${rubric.jobTitle || ''} ${industry} ${rawJD}`.toLowerCase();
  if (/workflow automation|automation coordinator|ai\s*&\s*automation|ai and automation|streamline admin|internal workflows|work smarter|process improvement|chatgpt|claude/.test(text)) return 'ai_automation_operations';
  if (/software engineer|developer|frontend|backend|full stack|devops|cloud engineer|platform engineer/.test(text)) return 'software_it';
  if (/data scientist|data analyst|machine learning|analytics|business intelligence|dashboard/.test(text)) return 'data_ai';
  if (/marketing|campaign|content|seo|brand/.test(text)) return 'marketing_content';
  if (/sales|account executive|business development|customer success|customer service|support/.test(text)) return 'sales_customer';
  if (/admin|administrator|office coordinator|reception|coordinator/.test(text)) return 'admin_coordination';
  if (/operations|process|workflow|coordinator|project delivery/.test(text)) return 'business_operations';
  if (/heavy diesel|hydraulic|machining|fabrication|field service|electrical|electronic engineering|manufacturing|civil|mechanical/.test(text)) return 'engineering_field';
  if (/health|nurse|clinic|patient|medical/.test(text)) return 'healthcare';
  if (/teach|school|student|education|curriculum/.test(text)) return 'education';
  if (/finance|accounting|payroll|bookkeep/.test(text)) return 'finance';
  if (/graduate|junior|entry[-\s]?level|intern/.test(text)) return 'general_graduate';
  return 'general';
};

const inferMustHave = ({ item = {}, category = '', importance = 'medium' } = {}) => {
  if (item.mustHave !== undefined) return Boolean(item.mustHave);
  if (item.type === 'bonus' || category === 'nice_to_have') return false;
  if (HARD_BLOCKER_CATEGORIES.has(category)) return importance !== 'low';
  if (category === 'experience') return item.type === 'hard' || /must|required|minimum|\d+\+?\s+years?/i.test(item.text || item.label || '');
  if (NON_BLOCKER_HIGH_IMPORTANCE_CATEGORIES.has(category)) return false;
  return item.type === 'hard' || false;
};

const normalizeRequirement = (item = {}, index = 0) => {
  const text = String(item.text || item.label || item.normalizedCapability || '').trim();
  if (!text || JD_SECTION_HEADING_PATTERN.test(text)) return null;
  const category = inferCategory(text, item.category);
  if (isCompanyContextRequirement(text, category)) return null;
  const importance = ['high', 'medium', 'low'].includes(item.importance) ? item.importance : 'medium';
  return {
    id: item.id || `req_${index + 1}`,
    text,
    label: text,
    category,
    normalizedCapability: String(item.normalizedCapability || text).trim(),
    importance,
    mustHave: inferMustHave({ item: { ...item, text }, category, importance }),
    evidenceNeeded: cleanEvidenceNeeded(item.evidenceNeeded, text),
  };
};

const buildFallbackRequirements = (rubric = {}) => (rubric.requirements || [])
  .map((item, index) => normalizeRequirement({
    id: item.id || `req_${index + 1}`,
    text: item.label,
    category: item.category,
    importance: item.importance,
    mustHave: item.type === 'hard' || undefined,
    type: item.type,
    evidenceNeeded: item.notes || '',
  }, index))
  .filter(Boolean);

const buildFallbackRoleProfile = ({ rawJD = '', rubric = {} } = {}) => {
  const requirements = buildFallbackRequirements(rubric);
  const industry = inferIndustry(rubric, rawJD);
  const roleDomain = inferRoleDomain({ rubric, rawJD, industry });
  return {
    schemaVersion: 'universal_role_profile_v2',
    roleTitle: rubric.title || rubric.jobTitle || rubric.jobOverview?.title || 'Target Role',
    industry,
    roleDomain,
    seniority: rubric.roleLevel || 'unspecified',
    employmentType: rubric.jobOverview?.employmentType || '',
    requirements,
    assessmentFocus: unique([
      ...requirements.filter((item) => item.mustHave || item.importance === 'high').slice(0, 5).map((item) => item.normalizedCapability),
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
  "roleDomain": "${ROLE_DOMAINS.join(' | ')}",
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
4. Mark nice-to-have and bonus items as mustHave=false and category="nice_to_have" unless the JD explicitly says they are required.
5. High-importance attitude signals like motivated, energetic, curious, proactive, or full of ideas should usually be category="motivation_or_attitude", "learning_agility", or "creativity_or_ideas", but mustHave=false unless the JD states a hard condition.
6. For AI-enabled business improvement roles, use roleDomain="ai_automation_operations" and prefer categories like "ai_tool_fluency", "workflow_automation", "process_improvement", "reporting_dashboard", "learning_agility", and "cross_functional_coordination".
7. Evidence needed must describe observable CV proof, not a JD section heading.
8. Do not use section headings like "About The Hiring Team" as requirements or evidenceNeeded.
9. Company descriptions, business unit descriptions, and hiring-team background must not become candidate requirements. Omit them or mark them as category="company_context".
10. Only include requirements that describe what the candidate must know, do, have, or demonstrate.

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

  const industry = String(parsed.industry || fallbackProfile.industry).trim();
  const parsedRoleDomain = ROLE_DOMAINS.includes(parsed.roleDomain) ? parsed.roleDomain : '';
  const roleDomain = parsedRoleDomain || inferRoleDomain({ rubric, rawJD, industry });

  return {
    ...fallbackProfile,
    schemaVersion: 'universal_role_profile_v2',
    roleTitle: String(parsed.roleTitle || fallbackProfile.roleTitle).trim(),
    industry,
    roleDomain,
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