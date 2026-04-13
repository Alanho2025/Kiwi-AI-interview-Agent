export const CAPABILITY_TAXONOMY = {
  automation: ['automate', 'automation', 'script', 'scripting', 'pipeline'],
  data_cleaning: ['data cleaning', 'cleaning', 'cleaned', 'preprocessing', 'transformation', 'extract', 'extraction'],
  process_improvement: ['process improvement', 'optimisation', 'optimization', 'improved', 'lowered', 'reduced', 'efficiency'],
  stakeholder_collaboration: ['cross-functional', 'stakeholder', 'stakeholders', 'collaborated', 'worked with', 'communication', 'communicated', 'communicator', 'status updates', 'presented', 'coordinating'],
  troubleshooting: ['defect investigation', 'failure analysis', 'failure pattern', 'root cause', 'production issue', 'debugging', 'troubleshooting'],
  documentation: ['documented', 'documentation', 'procedure', 'knowledge transfer', 'runbook', 'runbooks', 'technical documentation', 'operational documentation'],
  mentoring: ['onboarded', 'trained', 'guided', 'mentored'],
  deployment: ['deployed', 'deployment', 'deployments', 'aws ec2', 'production relational database', 'migrated the database', 'release', 'rollout', 'pipeline', 'pipelines', 'ci/cd'],
  api_development: ['api development', 'rest', 'endpoint', 'backend'],
  database_design: ['database schema', 'schema creation', 'postgresql', 'sql', 'database design'],
  frontend_development: ['react', 'frontend', 'front-end', 'ui', 'user customisation'],
  data_analysis: ['analysed', 'analyzed', 'analysis', 'insights', 'salary patterns', 'application behaviour', 'feature engineering'],
  ai_ml: ['artificial intelligence', 'ai', 'machine learning', 'deep learning', 'data mining'],
  testing_quality: ['testing', 'test data', 'quality assurance', 'debugging'],
  adaptability: ['adapted quickly', 'transition', 'new tools', 'new domains', 'learning quickly', 'learn quickly', 'learning new technologies quickly'],
  ownership: ['end-to-end', 'led', 'built practical solutions end to end', 'system design', 'owned', 'owning', 'responsible for'],
};

export const CAPABILITY_ALIASES = Object.entries(CAPABILITY_TAXONOMY).flatMap(([label, phrases]) =>
  phrases.map((phrase) => ({ label, phrase }))
);

export const inferCapabilitiesFromText = (text = '') => {
  const haystack = String(text || '').toLowerCase();
  return Object.entries(CAPABILITY_TAXONOMY)
    .filter(([, phrases]) => phrases.some((phrase) => haystack.includes(String(phrase).toLowerCase())))
    .map(([label]) => label);
};
