export const STATUS_ORDER = { not_met: 0, inferred: 1, partial: 2, met: 3 };

export const CORE_STACK_PATTERN = /c#|\.net|mvc|java(script)?|react|vue|angular|html|css|sql|aws|api|node|postgres/i;
export const COMMERCIAL_EXPERIENCE_PATTERN = /\b\d+\+?\s+years?|professional experience|commercial experience/i;
export const DEGREE_PATTERN = /computer science|software engineering|tertiary qualification|degree|bachelor|master/i;

export const SECTION_EVIDENCE_STRENGTH = {
  experience: 'strong',
  projects: 'strong',
  education: 'partial',
  volunteer: 'partial',
  keyCompetencies: 'weak',
  skills: 'weak',
  personalStatement: 'weak',
};

export const EVIDENCE_STRENGTH_ORDER = { missing: 0, weak: 1, partial: 2, strong: 3 };

export const STRICT_TECH_PATTERNS = {
  aws: /\b(aws|amazon web services|ec2|lambda|s3|rds|ecs|eks|cloudwatch|iam)\b/i,
  redis: /\bredis\b/i,
  elasticsearch: /\belasticsearch\b/i,
  kafka: /\b(kafka|distributed queue|distributed queueing|message queue|event streaming)\b/i,
  python: /\bpython\b/i,
  postgres: /\b(postgresql|postgres)\b/i,
  typescript: /\btypescript\b/i,
  nextjs: /\b(next\.js|nextjs)\b/i,
  vue: /\b(vue|vue\.js)\b/i,
  react: /\breact\b/i,
  node: /\b(node\.js|nodejs|node)\b/i,
  express: /\bexpress\b/i,
  docker: /\b(docker|container|containerised|containerized)\b/i,
  kubernetes: /\b(kubernetes|k8s)\b/i,
};

export const CLOUD_NATIVE_PATTERN = /\b(cloud-native|cloud native|kubernetes|k8s|docker|container|containerised|containerized|aws|azure|gcp|serverless|lambda|ecs|eks|ci\/cd|pipeline)\b/i;

export const CATEGORY_GROUPS = {
  hardBlocker: new Set(['qualification', 'certification', 'compliance_or_safety', 'availability_or_location']),
  responsibility: new Set(['responsibility', 'experience', 'process_improvement', 'workflow_automation', 'cross_functional_coordination', 'customer_or_stakeholder', 'leadership']),
  skillTool: new Set(['technical_skill', 'tool_or_platform', 'domain_knowledge', 'ai_tool_fluency', 'workflow_automation', 'productivity_tool', 'basic_integration', 'reporting_dashboard']),
  soft: new Set(['soft_skill', 'communication', 'leadership', 'customer_or_stakeholder', 'culture_fit', 'learning_agility', 'creativity_or_ideas', 'motivation_or_attitude', 'cross_functional_coordination']),
};

export const DOMAIN_PRIORITY_CATEGORIES = {
  ai_automation_operations: new Set(['ai_tool_fluency', 'workflow_automation', 'process_improvement', 'reporting_dashboard', 'learning_agility', 'creativity_or_ideas', 'productivity_tool', 'cross_functional_coordination', 'basic_integration']),
  business_operations: new Set(['process_improvement', 'workflow_automation', 'responsibility', 'communication', 'cross_functional_coordination', 'reporting_dashboard']),
  admin_coordination: new Set(['productivity_tool', 'communication', 'responsibility', 'cross_functional_coordination', 'reporting_dashboard']),
  sales_customer: new Set(['customer_or_stakeholder', 'communication', 'motivation_or_attitude', 'responsibility']),
  marketing_content: new Set(['communication', 'creativity_or_ideas', 'tool_or_platform', 'responsibility']),
  engineering_field: new Set(['domain_knowledge', 'compliance_or_safety', 'responsibility', 'process_improvement', 'communication']),
  general_graduate: new Set(['learning_agility', 'motivation_or_attitude', 'communication', 'responsibility', 'creativity_or_ideas']),
  general: new Set(['responsibility', 'communication', 'learning_agility', 'motivation_or_attitude']),
};

export const DOMAIN_SCORE_WEIGHTS = {
  software_it: { mustHaveFit: 0.3, responsibilityFit: 0.2, skillAndToolFit: 0.25, domainSpecificFit: 0.05, evidenceQuality: 0.1, softSkillAndCultureFit: 0.1 },
  data_ai: { mustHaveFit: 0.28, responsibilityFit: 0.18, skillAndToolFit: 0.24, domainSpecificFit: 0.1, evidenceQuality: 0.1, softSkillAndCultureFit: 0.1 },
  ai_automation_operations: { mustHaveFit: 0.2, responsibilityFit: 0.2, skillAndToolFit: 0.18, domainSpecificFit: 0.22, evidenceQuality: 0.1, softSkillAndCultureFit: 0.1 },
  business_operations: { mustHaveFit: 0.2, responsibilityFit: 0.25, skillAndToolFit: 0.12, domainSpecificFit: 0.23, evidenceQuality: 0.1, softSkillAndCultureFit: 0.1 },
  admin_coordination: { mustHaveFit: 0.18, responsibilityFit: 0.24, skillAndToolFit: 0.15, domainSpecificFit: 0.2, evidenceQuality: 0.1, softSkillAndCultureFit: 0.13 },
  sales_customer: { mustHaveFit: 0.18, responsibilityFit: 0.22, skillAndToolFit: 0.1, domainSpecificFit: 0.22, evidenceQuality: 0.1, softSkillAndCultureFit: 0.18 },
  marketing_content: { mustHaveFit: 0.18, responsibilityFit: 0.18, skillAndToolFit: 0.16, domainSpecificFit: 0.25, evidenceQuality: 0.1, softSkillAndCultureFit: 0.13 },
  engineering_field: { mustHaveFit: 0.28, responsibilityFit: 0.22, skillAndToolFit: 0.14, domainSpecificFit: 0.16, evidenceQuality: 0.1, softSkillAndCultureFit: 0.1 },
  healthcare: { mustHaveFit: 0.35, responsibilityFit: 0.2, skillAndToolFit: 0.05, domainSpecificFit: 0.15, evidenceQuality: 0.1, softSkillAndCultureFit: 0.15 },
  education: { mustHaveFit: 0.28, responsibilityFit: 0.2, skillAndToolFit: 0.06, domainSpecificFit: 0.2, evidenceQuality: 0.1, softSkillAndCultureFit: 0.16 },
  finance: { mustHaveFit: 0.3, responsibilityFit: 0.2, skillAndToolFit: 0.12, domainSpecificFit: 0.18, evidenceQuality: 0.1, softSkillAndCultureFit: 0.1 },
  general_graduate: { mustHaveFit: 0.18, responsibilityFit: 0.2, skillAndToolFit: 0.12, domainSpecificFit: 0.22, evidenceQuality: 0.1, softSkillAndCultureFit: 0.18 },
  general: { mustHaveFit: 0.22, responsibilityFit: 0.22, skillAndToolFit: 0.14, domainSpecificFit: 0.16, evidenceQuality: 0.1, softSkillAndCultureFit: 0.16 },
};
