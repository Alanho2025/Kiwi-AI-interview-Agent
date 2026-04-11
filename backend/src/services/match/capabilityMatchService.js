import { CAPABILITY_TAXONOMY } from './capabilityTaxonomy.js';

const JD_TO_CAPABILITY_HINTS = {
  api: 'api_development',
  rest: 'api_development',
  backend: 'api_development',
  database: 'database_design',
  sql: 'database_design',
  postgresql: 'database_design',
  react: 'frontend_development',
  frontend: 'frontend_development',
  deployment: 'deployment',
  aws: 'deployment',
  cloud: 'deployment',
  process: 'process_improvement',
  stakeholder: 'stakeholder_collaboration',
  teamwork: 'stakeholder_collaboration',
  collaboration: 'stakeholder_collaboration',
  automate: 'automation',
  automation: 'automation',
  cleaning: 'data_cleaning',
  analysis: 'data_analysis',
  ai: 'ai_ml',
  machine: 'ai_ml',
  testing: 'testing_quality',
};

export const inferRequiredCapabilities = (label = '') => {
  const lower = String(label || '').toLowerCase();
  const inferred = new Set();
  for (const [token, capability] of Object.entries(JD_TO_CAPABILITY_HINTS)) {
    if (lower.includes(token)) inferred.add(capability);
  }
  if (!inferred.size) {
    for (const [capability, phrases] of Object.entries(CAPABILITY_TAXONOMY)) {
      if (phrases.some((phrase) => lower.includes(String(phrase).toLowerCase()))) inferred.add(capability);
    }
  }
  return [...inferred];
};

export const computeCapabilityMatch = ({ label, evidenceProfile = {} }) => {
  const needed = inferRequiredCapabilities(label);
  const available = new Set([...(evidenceProfile.functionalCapabilities || []), ...(evidenceProfile.behaviouralCapabilities || [])]);
  const matched = needed.filter((item) => available.has(item));
  if (!needed.length || !matched.length) {
    return { matchedCapabilities: [], boost: 0, evidence: [] };
  }
  return {
    matchedCapabilities: matched,
    boost: Math.min(0.28, 0.12 + matched.length * 0.06),
    evidence: [`Capability match: ${matched.join(', ')}`],
  };
};
