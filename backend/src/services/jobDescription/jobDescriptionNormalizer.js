const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeLabel = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9+#. ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const titleAliases = [
  [/software engineer|software developer|developer/i, 'software_engineer'],
  [/backend engineer|backend developer|api engineer/i, 'backend_engineer'],
  [/frontend engineer|frontend developer|ui engineer/i, 'frontend_engineer'],
  [/full ?stack/i, 'full_stack_engineer'],
  [/data scientist/i, 'data_scientist'],
  [/data analyst/i, 'data_analyst'],
  [/machine learning|ml engineer|ai engineer/i, 'ai_ml_engineer'],
  [/devops|platform engineer|site reliability/i, 'platform_engineer'],
  [/business analyst/i, 'business_analyst'],
  [/product manager/i, 'product_manager'],
  [/it support|systems administrator|system administrator/i, 'it_support'],
];

export const canonicalizeRoleTitle = (title = '') => {
  const text = String(title || '').trim();
  if (!text) return 'general_role';
  const match = titleAliases.find(([pattern]) => pattern.test(text));
  return match ? match[1] : normalizeLabel(text).replace(/\s+/g, '_') || 'general_role';
};

export const inferRoleFamily = ({ roleFamily = '', roleCanonical = '', skills = [] } = {}) => {
  if (roleFamily) return roleFamily;
  const combined = [roleCanonical, ...ensureArray(skills)].join(' ').toLowerCase();
  if (/data|sql|python|bi|analytics/.test(combined)) return 'data';
  if (/ai|ml|machine learning|llm/.test(combined)) return 'ai_ml';
  if (/cloud|devops|kubernetes|terraform|linux|network/.test(combined)) return 'it_infrastructure';
  if (/product|roadmap|stakeholder/.test(combined)) return 'product';
  if (/software|backend|frontend|full_stack|java|c#|javascript|react|node/.test(combined)) return 'software_engineering';
  return 'general';
};

export const inferSeniority = ({ seniority = '', title = '', rawText = '' } = {}) => {
  const combined = `${seniority} ${title} ${rawText}`.toLowerCase();
  if (/graduate|intern|entry level|junior|new grad/.test(combined)) return 'junior';
  if (/senior|lead|principal|staff|architect/.test(combined)) return 'senior';
  if (/manager|head|director/.test(combined)) return 'leadership';
  if (/mid|intermediate/.test(combined)) return 'mid';
  return seniority || 'unknown';
};

export const normalizeRequirementItems = (items = [], { type = 'required' } = {}) => {
  const seen = new Set();
  return ensureArray(items)
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .map((item) => ({
      label: item,
      normalized: normalizeLabel(item),
      type,
    }))
    .filter((item) => {
      if (!item.normalized || seen.has(item.normalized)) return false;
      seen.add(item.normalized);
      return true;
    });
};

export const splitRequiredAndPreferred = ({
  requirements = [],
  mustHaveRequirements = [],
  niceToHaveRequirements = [],
  requiredSkills = [],
  preferredSkills = [],
} = {}) => {
  const explicitRequired = normalizeRequirementItems([...mustHaveRequirements, ...requiredSkills], { type: 'required' });
  const explicitPreferred = normalizeRequirementItems([...niceToHaveRequirements, ...preferredSkills], { type: 'preferred' });
  const remaining = normalizeRequirementItems(requirements, { type: 'required' })
    .filter((item) => !explicitRequired.some((required) => required.normalized === item.normalized)
      && !explicitPreferred.some((preferred) => preferred.normalized === item.normalized));

  return {
    required: [...explicitRequired, ...remaining],
    preferred: explicitPreferred,
  };
};
