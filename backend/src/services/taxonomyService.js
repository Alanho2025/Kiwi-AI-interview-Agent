const TERM_ALIASES = new Map([
  ['power bi', 'power_bi'],
  ['powerbi', 'power_bi'],
  ['tableau', 'tableau'],
  ['sql', 'sql'],
  ['structured query language', 'sql'],
  ['javascript', 'javascript'],
  ['js', 'javascript'],
  ['typescript', 'typescript'],
  ['node', 'node_js'],
  ['node js', 'node_js'],
  ['node.js', 'node_js'],
  ['react', 'react'],
  ['reactjs', 'react'],
  ['react.js', 'react'],
  ['aws', 'aws'],
  ['amazon web services', 'aws'],
  ['azure', 'azure'],
  ['gcp', 'gcp'],
  ['google cloud', 'gcp'],
  ['communication', 'communication'],
  ['stakeholder communication', 'stakeholder_communication'],
  ['stakeholder management', 'stakeholder_management'],
  ['stakeholder engagement', 'stakeholder_management'],
  ['teamwork', 'teamwork'],
  ['team work', 'teamwork'],
  ['collaboration', 'collaboration'],
  ['problem solving', 'problem_solving'],
  ['problem-solving', 'problem_solving'],
  ['critical thinking', 'critical_thinking'],
  ['adaptability', 'adaptability'],
  ['leadership', 'leadership'],
  ['agile', 'agile'],
  ['agile methodologies', 'agile'],
  ['scrum', 'scrum'],
  ['kanban', 'kanban'],
  ['customer relationship management', 'crm'],
  ['crm', 'crm'],
  ['quality management systems', 'quality_management_systems'],
  ['qms', 'quality_management_systems'],
  ['pre-sales', 'pre_sales'],
  ['pre sales', 'pre_sales'],
  ['presales', 'pre_sales'],
  ['machine learning', 'machine_learning'],
  ['deep learning', 'deep_learning'],
  ['data science', 'data_science'],
  ['data analysis', 'data_analysis'],
  ['analytics', 'analytics'],
  ['project management', 'project_management'],
  ['client relationship management', 'client_relationship_management'],
  ['client relationship', 'client_relationship_management'],
  ['client relations', 'client_relationship_management'],
]);

const ROLE_CANONICAL_RULES = [
  { canonical: 'data_scientist', family: 'data_science', patterns: [/data scientist/i, /content science/i] },
  { canonical: 'data_analyst', family: 'analytics', patterns: [/data analyst/i, /business intelligence/i, /analytics?/i] },
  { canonical: 'machine_learning_engineer', family: 'data_science', patterns: [/machine learning engineer/i, /ml engineer/i, /ai engineer/i] },
  { canonical: 'software_engineer', family: 'software_engineering', patterns: [/software engineer/i, /software developer/i, /programmer/i] },
  { canonical: 'frontend_engineer', family: 'frontend', patterns: [/front[ -]?end/i, /ui engineer/i, /react developer/i] },
  { canonical: 'backend_engineer', family: 'backend', patterns: [/back[ -]?end/i, /api developer/i, /server[- ]side/i] },
  { canonical: 'full_stack_engineer', family: 'software_engineering', patterns: [/full[ -]?stack/i] },
  { canonical: 'devops_engineer', family: 'devops', patterns: [/devops/i, /site reliability/i, /sre/i, /platform engineer/i] },
  { canonical: 'accessibility_specialist', family: 'frontend', patterns: [/accessibility specialist/i, /web accessibility/i] },
  { canonical: 'big_data_administrator', family: 'data_engineering', patterns: [/big data/i, /data warehousing/i, /data engineer/i] },
  { canonical: 'project_manager', family: 'project_management', patterns: [/project manager/i, /program manager/i, /delivery manager/i] },
];

export const slugifyLabel = (value = '') =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');

export const normalizeTaxonomyLabel = (value = '') => {
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return '';
  return TERM_ALIASES.get(cleaned) || slugifyLabel(cleaned);
};

export const buildTaxonomyItem = (label, extra = {}) => ({
  id: normalizeTaxonomyLabel(label),
  label: label?.trim() || '',
  ...extra,
});

export const uniqueById = (items = []) => {
  const seen = new Set();
  return items.filter((item) => {
    const id = item?.id || normalizeTaxonomyLabel(item?.label || item || '');
    if (!id || seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

export const mergeUniqueLabels = (...groups) => {
  const flattened = groups.flat().filter(Boolean);
  const mapped = flattened.map((item) => typeof item === 'string' ? buildTaxonomyItem(item) : buildTaxonomyItem(item.label || item.id || '', item));
  return uniqueById(mapped);
};

export const canonicalizeRole = (title = '', fallbackText = '') => {
  const combined = `${title} ${fallbackText}`.trim();
  for (const rule of ROLE_CANONICAL_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(combined))) {
      return { roleCanonical: rule.canonical, roleFamily: rule.family };
    }
  }
  return {
    roleCanonical: normalizeTaxonomyLabel(title || fallbackText || 'target_role') || 'target_role',
    roleFamily: /data|analytics|machine learning|sql|python/i.test(combined) ? 'data_science' : 'general',
  };
};

export const inferRoleLevel = (text = '') => {
  if (/intern|apprentice|graduate/i.test(text)) return 'intern';
  if (/junior|entry level|associate/i.test(text)) return 'junior';
  if (/senior|principal|staff/i.test(text)) return 'senior';
  if (/lead|manager|head of/i.test(text)) return 'lead';
  return 'mid';
};

export const prettifyCanonicalRole = (canonical = '') =>
  canonical
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
