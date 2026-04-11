const ROLE_FAMILY_RULES = [
  { type: 'software_development', patterns: [/software developer/i, /software engineer/i, /full stack/i, /front[ -]?end/i, /back[ -]?end/i, /c#/i, /\.net/i, /asp\.net/i, /mvc/i] },
  { type: 'data', patterns: [/data analyst/i, /data engineer/i, /bi analyst/i, /business intelligence/i, /sql/i, /tableau/i, /power bi/i, /dashboard/i] },
  { type: 'ai_ml', patterns: [/ai engineer/i, /ml engineer/i, /machine learning/i, /llm/i, /rag/i, /embeddings/i, /pytorch/i, /tensorflow/i] },
  { type: 'it_infrastructure', patterns: [/it support/i, /systems administrator/i, /cloud engineer/i, /network engineer/i, /linux/i, /windows server/i, /active directory/i, /networking/i] },
];

export const detectJobDescriptionRoleFamily = ({ title = '', text = '', groupedTechnicalSkills = {} }) => {
  const combined = `${title}\n${text}\n${Object.values(groupedTechnicalSkills).flat().map((item) => item.label || item.name || '').join(' ')}`;
  for (const rule of ROLE_FAMILY_RULES) {
    const matchedSignals = rule.patterns.filter((pattern) => pattern.test(combined)).map((pattern) => pattern.source);
    if (matchedSignals.length > 0) {
      return { primary: rule.type, confidence: 0.9, matchedSignals };
    }
  }
  return { primary: 'mixed', confidence: 0.55, matchedSignals: [] };
};
