const SCORE_RULES = {
  software_development: [
    [/full stack|frontend|front-end|backend|back-end|web developer|web software engineer|software developer|software engineer/i, 3, 'title_or_role_signal'],
    [/react|vue|angular|php|javascript|typescript|c#|\.net|restful api|html5|css/i, 1.5, 'software_skill_signal'],
    [/feature development|build.*platform|api development|code review|ci\/cd|technical mentorship/i, 1.2, 'software_delivery_signal'],
  ],
  data: [
    [/data analyst|data engineer|analytics|geospatial|statistics/i, 3, 'title_or_role_signal'],
    [/sql|snowflake|power bi|power query|excel|arcgis|jupyter|keras|pytorch|scipy/i, 1.5, 'data_skill_signal'],
    [/datasets|statistical methods|analytics outputs|data quality|insights/i, 1.2, 'data_delivery_signal'],
  ],
  ai_ml: [
    [/ai engineer|ai-enabled|data and ai engineer|llm|rag|agentic|retrieval augmented generation/i, 3, 'title_or_role_signal'],
    [/openai|azure openai|automation focus|ai-first|model evaluation|evals/i, 1.7, 'ai_skill_signal'],
    [/ai tools|agentic workflows|automation|prompt/i, 1.2, 'ai_delivery_signal'],
  ],
  it_infrastructure: [
    [/systems developer|systems integration|tech support|network support|hardware setup|software troubleshooting/i, 3, 'title_or_role_signal'],
    [/aws hosted|cloud|linux|windows server|support tasks/i, 1.4, 'it_skill_signal'],
    [/internal tech support|staff computer issues|hardware|software issue/i, 1.1, 'it_delivery_signal'],
  ],
  product: [
    [/product developer|product-led|commercial mindset|revenue platform|gtm|sales tooling/i, 3, 'product_title_signal'],
    [/stakeholder collaboration|sales|marketing|revops|customer acquisition/i, 1.6, 'product_signal'],
    [/translate business needs|product-driven engineering/i, 1.3, 'product_delivery_signal'],
  ],
};

const scoreFamily = (combined = '', family = 'general') => {
  const matchedSignals = [];
  const score = (SCORE_RULES[family] || []).reduce((sum, [pattern, weight, label]) => {
    if (!pattern.test(combined)) return sum;
    matchedSignals.push(label);
    return sum + weight;
  }, 0);
  return { family, score, matchedSignals };
};

export const resolveRoleFamily = ({ title = '', flatText = '', groupedTechnicalSkills = {} } = {}) => {
  const skillText = Object.values(groupedTechnicalSkills).flat().map((item) => item.label || item.name || '').join(' ');
  const combined = `${title}\n${flatText}\n${skillText}`;
  if (/graduate programme/i.test(title)) return { primary: 'general', secondary: undefined, confidence: 0.92, matchedSignals: ['graduate_programme'], scores: { general: 1 } };

  const scored = Object.keys(SCORE_RULES)
    .map((family) => scoreFamily(combined, family))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return { primary: 'general', secondary: undefined, confidence: 0.5, matchedSignals: [], scores: { general: 0 } };

  const [best, second] = scored;
  const softwareHybridBoost = best.family === 'ai_ml' && second?.family === 'software_development' && /full stack|developer|engineer|react|typescript|c#|\.net/i.test(combined);
  const resolvedBest = softwareHybridBoost ? second : best;
  const resolvedSecond = softwareHybridBoost ? best : second;

  return {
    primary: resolvedBest.family,
    secondary: resolvedSecond?.family,
    confidence: Number(Math.min(0.96, 0.58 + resolvedBest.score * 0.06).toFixed(2)),
    matchedSignals: resolvedBest.matchedSignals,
    scores: Object.fromEntries(scored.map((item) => [item.family, item.score])),
  };
};
