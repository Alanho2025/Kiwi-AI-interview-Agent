import { callDeepSeekJson } from '../agenticSafeguards/deepseekJsonClient.js';
import { normalizeTaxonomyLabel } from '../taxonomyService.js';
import { unique } from './jobDescriptionShared.js';
import { isJobDescriptionSectionHeading } from './jobDescriptionSectionHeadingGuard.js';

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
  'professional_services',
  'general_graduate',
  'general',
  'unknown',
];

export const UNIVERSAL_CAPABILITY_GROUPS = [
  'professional_credential',
  'domain_knowledge',
  'technical_or_tool_skill',
  'analysis_and_problem_solving',
  'communication',
  'stakeholder_collaboration',
  'planning_and_organisation',
  'research_and_learning',
  'compliance_ethics_safety',
  'creativity_and_design',
  'data_and_reporting',
  'process_improvement',
  'customer_or_client_focus',
  'leadership_and_ownership',
  'field_or_practical_work',
  'commercial_or_business_awareness',
  'service_delivery',
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
  'professional_registration',
  'insurance_or_indemnity',
  'assessment_delivery',
  'report_writing',
  'case_management',
  'experience',
  'responsibility',
  'soft_skill',
  'communication',
  'leadership',
  'customer_or_stakeholder',
  'compliance_or_safety',
  'availability_or_location',
  'scheduling_or_time_management',
  'culture_fit',
  'nice_to_have',
  'company_context',
];

const HARD_BLOCKER_CATEGORIES = new Set([
  'qualification',
  'certification',
  'professional_registration',
  'insurance_or_indemnity',
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
  [/board|registered|registration/i, 'professional_registration'],
  [/professional indemnity|indemnity insurance|insurance/i, 'insurance_or_indemnity'],
  [/certificat|licen[cs]e/i, 'certification'],
  [/degree|bachelor|master|qualification|diploma/i, 'qualification'],
  [/assessment|diagnostic|telehealth|practitioner model|framework|clinical/i, 'assessment_delivery'],
  [/report writing|assessment report|write clear|professional report|recommendations/i, 'report_writing'],
  [/schedule|calendar|deadline|turn around|priorit|competing priorities/i, 'scheduling_or_time_management'],
  [/client|referrer|educator|stakeholder|rapport|relationship/i, 'customer_or_stakeholder'],
  [/chatgpt|claude|generative ai|ai tools?|large language model|llm/i, 'ai_tool_fluency'],
  [/workflow automation|automate workflows?|automation tools?|zapier|make\.com|integromat|power automate/i, 'workflow_automation'],
  [/process improvement|improve processes|streamline|efficiency|work smarter|smarter systems|operational improvement/i, 'process_improvement'],
  [/reporting|dashboard|analytics|insights|data visuali[sz]ation|spreadsheet/i, 'reporting_dashboard'],
  [/google workspace|google docs|google sheets|microsoft office|excel|productivity tools?/i, 'productivity_tool'],
  [/api integration|integrations?|basic coding|scripting|webhook/i, 'basic_integration'],
  [/curious|experiment|learn quickly|learning|trial new|research new tools?|supervision|training/i, 'learning_agility'],
  [/full of ideas|new ideas|creative|innovation|innovative|ideas/i, 'creativity_or_ideas'],
  [/motivated|energetic|proactive|passion|driven|initiative/i, 'motivation_or_attitude'],
  [/cross[-\s]?functional|across teams|departments|coordinate|collaborat|support teams|independently and collaboratively/i, 'cross_functional_coordination'],
  [/years?|professional|commercial|experience/i, 'experience'],
  [/aws|azure|gcp|redis|elasticsearch|kafka|queue|salesforce|sql|python|typescript|next\.js|vue|react|node|software|platform/i, 'tool_or_platform'],
  [/safety|compliance|privacy|regulatory|legal|policy|ethic|quality assurance|gold standard/i, 'compliance_or_safety'],
  [/communicat|writing|present|documentation|oral communication/i, 'communication'],
  [/lead|manage|mentor|supervis/i, 'leadership'],
  [/teamwork|adapt|culture|values/i, 'culture_fit'],
  [/responsib|deliver|support|handle|maintain|prepare|conduct|perform|participate/i, 'responsibility'],
];

const CAPABILITY_BY_CATEGORY = {
  qualification: 'professional_credential',
  certification: 'professional_credential',
  professional_registration: 'professional_credential',
  insurance_or_indemnity: 'professional_credential',
  domain_knowledge: 'domain_knowledge',
  assessment_delivery: 'domain_knowledge',
  technical_skill: 'technical_or_tool_skill',
  tool_or_platform: 'technical_or_tool_skill',
  ai_tool_fluency: 'technical_or_tool_skill',
  productivity_tool: 'technical_or_tool_skill',
  basic_integration: 'technical_or_tool_skill',
  workflow_automation: 'process_improvement',
  process_improvement: 'process_improvement',
  reporting_dashboard: 'data_and_reporting',
  report_writing: 'communication',
  communication: 'communication',
  customer_or_stakeholder: 'stakeholder_collaboration',
  cross_functional_coordination: 'stakeholder_collaboration',
  scheduling_or_time_management: 'planning_and_organisation',
  learning_agility: 'research_and_learning',
  compliance_or_safety: 'compliance_ethics_safety',
  creativity_or_ideas: 'creativity_and_design',
  motivation_or_attitude: 'leadership_and_ownership',
  leadership: 'leadership_and_ownership',
  responsibility: 'leadership_and_ownership',
  experience: 'field_or_practical_work',
  case_management: 'service_delivery',
  soft_skill: 'communication',
  culture_fit: 'commercial_or_business_awareness',
  availability_or_location: 'planning_and_organisation',
  nice_to_have: 'technical_or_tool_skill',
  company_context: 'commercial_or_business_awareness',
};

const CAPABILITY_BY_PATTERN = [
  [/registered|registration|qualification|certificat|indemnity|insurance|board/i, 'professional_credential'],
  [/assessment|diagnostic|clinical|practitioner model|framework|domain|subject matter|legal|accounting|engineering/i, 'domain_knowledge'],
  [/tool|software|platform|chatgpt|claude|google workspace|excel|api|coding|automation tool/i, 'technical_or_tool_skill'],
  [/problem|solve|analysis|analyse|analyze|reasoning|diagnostic|interpret/i, 'analysis_and_problem_solving'],
  [/communicat|writing|report|feedback session|presentation|explain/i, 'communication'],
  [/stakeholder|client|referrer|team|collaborat|relationship|rapport/i, 'stakeholder_collaboration'],
  [/schedule|calendar|deadline|priorit|organis|organize|available slots/i, 'planning_and_organisation'],
  [/research|learn|trial|experiment|training|supervision|new tools/i, 'research_and_learning'],
  [/compliance|ethic|privacy|safety|quality assurance|gold standard|policy/i, 'compliance_ethics_safety'],
  [/design|creative|ideas|innovation/i, 'creativity_and_design'],
  [/data|reporting|dashboard|insight|analysis|analytics/i, 'data_and_reporting'],
  [/process|workflow|streamline|efficiency|improve|automate/i, 'process_improvement'],
  [/customer|user|client|service/i, 'customer_or_client_focus'],
  [/lead|ownership|initiative|proactive|motivated|responsible/i, 'leadership_and_ownership'],
  [/field|hands[-\s]?on|practical|site|conduct|perform/i, 'field_or_practical_work'],
  [/business|commercial|operation|industry|cost|value/i, 'commercial_or_business_awareness'],
  [/service|deliverable|assessment service|case|consultancy|intervention/i, 'service_delivery'],
];

const COMPANY_CONTEXT_PATTERN = /\b(this organisation|this organization|we are|we're|our company|our team|business unit|hiring team|about the hiring team|about us|well-established|one stop shop|across heavy diesel|growing business|auckland based technology business|investing heavily|strong engineering and product focus)\b/i;
const CANDIDATE_REQUIREMENT_PATTERN = /\b(you will|you'll|you are|you have|you bring|you can|you should|candidate|engineer who|engineers who|looking for|must|required|responsible for|experience with|strong experience|ability to|proficient|familiar|knowledge of|what we're looking for|about you|selection criteria)\b/i;

const isCompanyContextRequirement = (text = '', category = '') => {
  const normalized = String(text || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return false;
  if (category === 'company_context') return true;
  if (!COMPANY_CONTEXT_PATTERN.test(normalized)) return false;
  return !CANDIDATE_REQUIREMENT_PATTERN.test(normalized);
};

const cleanEvidenceNeeded = (value = '', requirementText = '') => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text || isJobDescriptionSectionHeading(text)) {
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

const inferCapabilityGroup = (text = '', category = '', fallback = '') => {
  if (UNIVERSAL_CAPABILITY_GROUPS.includes(fallback)) return fallback;
  if (CAPABILITY_BY_CATEGORY[category]) return CAPABILITY_BY_CATEGORY[category];
  const match = CAPABILITY_BY_PATTERN.find(([pattern]) => pattern.test(text));
  return match?.[1] || 'analysis_and_problem_solving';
};

const inferIndustry = (rubric = {}, rawJD = '') => {
  const text = `${rubric.roleFamily || ''} ${rubric.title || ''} ${rawJD}`.toLowerCase();
  if (/psycholog|counselling|social work|clinical|health|nurse|clinic|patient|medical/.test(text)) return 'Healthcare';
  if (/teach|school|student|education|curriculum/.test(text)) return 'Education';
  if (/sales|account executive|business development/.test(text)) return 'Sales';
  if (/marketing|campaign|content|seo|brand/.test(text)) return 'Marketing';
  if (/finance|accounting|payroll|bookkeep/.test(text)) return 'Finance';
  if (/law|legal|solicitor|barrister|contract/.test(text)) return 'Professional services';
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
  if (/psycholog|clinical|counselling|healthcare|medical|patient|telehealth|assessment/.test(text)) return 'healthcare';
  if (/marketing|campaign|content|seo|brand|design|designer|ux|visual/.test(text)) return 'marketing_content';
  if (/sales|account executive|business development|customer success|customer service|support/.test(text)) return 'sales_customer';
  if (/law|legal|solicitor|barrister|accounting|accountant|audit|tax/.test(text)) return 'professional_services';
  if (/admin|administrator|office coordinator|reception|coordinator/.test(text)) return 'admin_coordination';
  if (/operations|process|workflow|coordinator|project delivery/.test(text)) return 'business_operations';
  if (/heavy diesel|hydraulic|machining|fabrication|field service|electrical|electronic engineering|manufacturing|civil|mechanical/.test(text)) return 'engineering_field';
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
  if (!text || isJobDescriptionSectionHeading(text)) return null;
  const category = inferCategory(text, item.category);
  if (isCompanyContextRequirement(text, category)) return null;
  const importance = ['high', 'medium', 'low'].includes(item.importance) ? item.importance : 'medium';
  const capabilityGroup = inferCapabilityGroup(text, category, item.capabilityGroup);
  return {
    id: item.id || `req_${index + 1}`,
    text,
    label: text,
    category,
    capabilityGroup,
    normalizedCapability: String(item.normalizedCapability || text).trim(),
    importance,
    mustHave: inferMustHave({ item: { ...item, text }, category, importance }),
    evidenceNeeded: cleanEvidenceNeeded(item.evidenceNeeded, text),
  };
};

const buildCapabilityProfile = (requirements = []) => {
  const grouped = new Map();
  for (const requirement of requirements) {
    const group = requirement.capabilityGroup || inferCapabilityGroup(requirement.text, requirement.category);
    if (!grouped.has(group)) grouped.set(group, []);
    grouped.get(group).push(requirement);
  }
  return Array.from(grouped.entries()).map(([group, items]) => ({
    group,
    labels: unique(items.map((item) => item.normalizedCapability || item.label).filter(Boolean)).slice(0, 6),
    weight: Number((items.reduce((sum, item) => sum + (item.mustHave ? 1.6 : item.importance === 'high' ? 1.25 : item.importance === 'low' ? 0.75 : 1), 0) / Math.max(1, requirements.length)).toFixed(3)),
    mustHaveCount: items.filter((item) => item.mustHave).length,
    evidenceNeeded: unique(items.map((item) => item.evidenceNeeded).filter(Boolean)).slice(0, 4),
  }));
};

const buildFallbackRequirements = (rubric = {}) => (rubric.requirements || [])
  .map((item, index) => normalizeRequirement({
    id: item.id || `req_${index + 1}`,
    text: item.label,
    category: item.category,
    capabilityGroup: item.capabilityGroup,
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
    schemaVersion: 'universal_role_profile_v3',
    roleTitle: rubric.title || rubric.jobTitle || rubric.jobOverview?.title || 'Target Role',
    industry,
    roleDomain,
    seniority: rubric.roleLevel || 'unspecified',
    employmentType: rubric.jobOverview?.employmentType || '',
    requirements,
    capabilityProfile: buildCapabilityProfile(requirements),
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
  "industry": "IT | Data and AI | Marketing | Sales | Customer service | Administration | Healthcare | Education | Engineering | Operations | Finance | Professional services | General",
  "roleDomain": "${ROLE_DOMAINS.join(' | ')}",
  "seniority": "Entry-level | Junior | Mid-level | Senior | Lead | Manager | unspecified",
  "employmentType": "string",
  "requirements": [
    {
      "id": "req_1",
      "text": "single role requirement",
      "category": "${UNIVERSAL_REQUIREMENT_CATEGORIES.join(' | ')}",
      "capabilityGroup": "${UNIVERSAL_CAPABILITY_GROUPS.join(' | ')}",
      "normalizedCapability": "short capability label",
      "importance": "high | medium | low",
      "mustHave": true,
      "evidenceNeeded": "what the CV must show"
    }
  ],
  "capabilityProfile": [
    {
      "group": "${UNIVERSAL_CAPABILITY_GROUPS.join(' | ')}",
      "labels": ["string"],
      "weight": 0.2,
      "evidenceNeeded": ["string"]
    }
  ],
  "assessmentFocus": ["string"]
}

Rules:
1. Support any job family, not only IT.
2. Keep each requirement atomic.
3. Do not invent legal, certification, location, or qualification requirements.
4. Mark nice-to-have and bonus items as mustHave=false and category="nice_to_have" unless the JD explicitly says they are required.
5. High-importance attitude signals like motivated, energetic, curious, proactive, or full of ideas should usually be category="motivation_or_attitude", but mustHave=false unless the JD states a hard condition.
6. Always assign capabilityGroup from the universal capability list. This is the main cross-role scoring axis.
7. For AI-enabled business improvement roles, use roleDomain="ai_automation_operations" and map requirements to technical_or_tool_skill, process_improvement, data_and_reporting, research_and_learning, communication, and stakeholder_collaboration as appropriate.
8. For regulated professional roles, map registration to professional_credential, formal assessment or specialist practice to domain_knowledge/service_delivery, report writing to communication, scheduling to planning_and_organisation, and relationship work to stakeholder_collaboration or customer_or_client_focus.
9. Evidence needed must describe observable CV proof, not a JD section heading.
10. Do not use section headings as requirements or evidenceNeeded.
11. Company descriptions, business unit descriptions, and hiring-team background must not become candidate requirements. Omit them or mark them as category="company_context".
12. Only include requirements that describe what the candidate must know, do, have, or demonstrate.

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
    .slice(0, 32);

  if (!requirements.length) return fallbackProfile;

  const industry = String(parsed.industry || fallbackProfile.industry).trim();
  const parsedRoleDomain = ROLE_DOMAINS.includes(parsed.roleDomain) ? parsed.roleDomain : '';
  const roleDomain = parsedRoleDomain || inferRoleDomain({ rubric, rawJD, industry });
  const capabilityProfile = buildCapabilityProfile(requirements);

  return {
    ...fallbackProfile,
    schemaVersion: 'universal_role_profile_v3',
    roleTitle: String(parsed.roleTitle || fallbackProfile.roleTitle).trim(),
    industry,
    roleDomain,
    seniority: String(parsed.seniority || fallbackProfile.seniority).trim(),
    employmentType: String(parsed.employmentType || fallbackProfile.employmentType).trim(),
    requirements,
    capabilityProfile,
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
    capabilityGroupBreakdown: requirements.reduce((accumulator, item) => {
      accumulator[item.capabilityGroup] = (accumulator[item.capabilityGroup] || 0) + 1;
      return accumulator;
    }, {}),
    requirementIdsByLabel: Object.fromEntries(requirements.map((item) => [normalizeTaxonomyLabel(item.text), item.id])),
  };
};
