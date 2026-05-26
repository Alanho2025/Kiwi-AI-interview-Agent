const normalizeText = (value = '') => String(value || '').trim();
const tokenize = (value = '') => normalizeText(value).toLowerCase().split(/[^a-z0-9%]+/).filter(Boolean);

const hasAny = (tokens = [], values = []) => values.some((value) => tokens.includes(value));
const hasPattern = (text = '', pattern) => pattern.test(String(text || '').toLowerCase());

const toLabel = (score = 0) => (score >= 2 ? 'clear' : score >= 1 ? 'partial' : 'missing');

export const analyzeStarBreakdown = (answerText = '') => {
  const text = normalizeText(answerText);
  const lower = text.toLowerCase();
  const tokens = tokenize(text);
  const wordCount = tokens.length;

  const situationScore = Math.min(2, (
    (wordCount >= 18 ? 1 : 0)
    + (hasPattern(lower, /\b(project|role|team|client|user|workflow|system|feature|deadline|incident|when|during|at)\b/) ? 1 : 0)
  ));
  const taskScore = Math.min(2, (
    (hasPattern(lower, /\b(goal|needed|responsible|task|requirement|challenge|problem|issue|target|objective)\b/) ? 1 : 0)
    + (hasPattern(lower, /\b(had to|needed to|my role|i was responsible|asked to|we needed)\b/) ? 1 : 0)
  ));
  const actionScore = Math.min(2, (
    (hasPattern(lower, /\b(i|my|me)\b/) && hasAny(tokens, ['built', 'designed', 'implemented', 'led', 'owned', 'fixed', 'improved', 'handled', 'created', 'deployed', 'checked', 'tested', 'used', 'coordinated']) ? 1 : 0)
    + (hasPattern(lower, /\b(compared|validated|debugged|separated|refactored|automated|analysed|analyzed|worked with|coordinated)\b/) ? 1 : 0)
  ));
  const resultScore = Math.min(2, (
    (/\d/.test(text) || hasPattern(lower, /\b(result|impact|outcome|improved|reduced|increased|saved|faster|slower|validated|tested|learned)\b/) ? 1 : 0)
    + (hasPattern(lower, /\b(%|percent|minutes?|hours?|users?|requests?|latency|throughput|conversion|accuracy|uptime)\b/) ? 1 : 0)
  ));

  const scoreMap = { situation: situationScore, task: taskScore, action: actionScore, result: resultScore };
  const mainMissingElement = Object.entries(scoreMap)
    .sort((left, right) => left[1] - right[1])[0]?.[0] || 'result';
  const totalScore = situationScore + taskScore + actionScore + resultScore;

  return {
    situation: toLabel(situationScore),
    task: toLabel(taskScore),
    action: toLabel(actionScore),
    result: toLabel(resultScore),
    scores: scoreMap,
    totalScore,
    maxScore: 8,
    mainMissingElement,
    scoreReason: resultScore === 0
      ? 'The answer does not include a clear outcome, impact, or lesson.'
      : actionScore === 0
        ? 'The answer does not clearly show what the candidate personally did.'
        : totalScore >= 6
          ? 'The answer contains usable STAR evidence with some room to sharpen detail.'
          : 'The answer has partial STAR evidence and needs clearer context, responsibility, action, or result.',
  };
};

export const compareStarBreakdowns = (previous = null, current = null) => {
  if (!previous || !current) return null;
  const previousTotal = Number(previous.totalScore || 0);
  const currentTotal = Number(current.totalScore || 0);
  const keys = ['situation', 'task', 'action', 'result'];
  return {
    scoreChange: `${previousTotal} -> ${currentTotal}`,
    improved: currentTotal > previousTotal,
    mainReason: currentTotal > previousTotal
      ? `You improved ${keys.filter((key) => previous[key] !== current[key]).join(', ') || 'the STAR structure'}.`
      : 'The STAR structure did not improve yet.',
    detailedChange: Object.fromEntries(keys.map((key) => [key, `${previous[key] || 'missing'} -> ${current[key] || 'missing'}`])),
  };
};
