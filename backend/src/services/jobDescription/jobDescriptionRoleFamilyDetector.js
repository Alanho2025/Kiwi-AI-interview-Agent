const ROLE_FAMILY_RULES = [
  {
    type: 'software_development',
    patterns: [/software developer/i, /software engineer/i, /full stack/i, /frontend/i, /front[ -]?end/i, /backend/i, /back[ -]?end/i, /web developer/i, /web software engineer/i, /react/i, /vue/i, /angular/i, /php/i, /c#/i, /\.net/i],
  },
  {
    type: 'data',
    patterns: [/data analyst/i, /data engineer/i, /analytics/i, /geospatial/i, /statistics/i, /power bi/i, /power query/i, /excel/i, /snowflake/i, /arcgis/i],
  },
  {
    type: 'ai_ml',
    patterns: [/ai engineer/i, /ai[- ]enabled/i, /data and ai engineer/i, /llm/i, /rag/i, /retrieval augmented generation/i, /agentic/i, /openai/i, /azure openai/i, /automation focus/i, /ai-first/i, /prompt/i, /keras/i, /pytorch/i],
  },
  {
    type: 'it_infrastructure',
    patterns: [/systems developer/i, /systems integration/i, /tech support/i, /hardware/i, /software troubleshooting/i, /network support/i, /aws hosted/i, /cloud/i, /linux/i, /windows server/i],
  },
  {
    type: 'product',
    patterns: [/product developer/i, /commercial mindset/i, /revenue platforms/i, /gtm/i, /sales tooling/i, /stakeholder collaboration across sales/i],
  },
];

const scoreRule = (combined = '', patterns = []) => patterns.reduce((sum, pattern) => sum + (pattern.test(combined) ? 1 : 0), 0);

export const detectJobDescriptionRoleFamily = ({ title = '', text = '', groupedTechnicalSkills = {} }) => {
  const combined = `${title}\n${text}\n${Object.values(groupedTechnicalSkills).flat().map((item) => item.label || item.name || '').join(' ')}`;
  if (/graduate programme/i.test(title)) return { primary: 'general', confidence: 0.9, matchedSignals: ['graduate programme'] };
  if (/\bai\b|llm|rag|agentic/i.test(title)) {
    return { primary: 'ai_ml', secondary: /developer|engineer|full stack/i.test(title) ? 'software_development' : undefined, confidence: 0.9, matchedSignals: ['title_ai_signal'] };
  }
  const scores = ROLE_FAMILY_RULES
    .map((rule) => ({ type: rule.type, score: scoreRule(combined, rule.patterns), matchedSignals: rule.patterns.filter((pattern) => pattern.test(combined)).map((pattern) => pattern.source) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scores.length === 0) return { primary: 'general', confidence: 0.5, matchedSignals: [] };
  const [best, second] = scores;
  return {
    primary: best.type,
    secondary: second?.type,
    confidence: Number(Math.min(0.95, 0.62 + best.score * 0.08).toFixed(2)),
    matchedSignals: best.matchedSignals,
  };
};
