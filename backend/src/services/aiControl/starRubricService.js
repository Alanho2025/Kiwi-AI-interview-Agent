import { normalizeText, tokenize } from '../../utils/commonHelpers.js';

const hasAny = (tokens = [], values = []) => values.some((value) => tokens.includes(value));
const hasPattern = (text = '', pattern) => pattern.test(String(text || '').toLowerCase());

const toLabel = (score = 0) => (score >= 2 ? 'clear' : score >= 1 ? 'partial' : 'missing');

export const analyzeStarrBreakdown = (answerText = '') => {
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
  const resultOrReactionScore = Math.min(2, (
    (/\d/.test(text) || hasPattern(lower, /\b(result|impact|outcome|improved|reduced|increased|saved|faster|slower|validated|tested|feedback|reaction|said|told|happy|satisfied|response|resolved)\b/) ? 1 : 0)
    + (hasPattern(lower, /\b(%|percent|minutes?|hours?|users?|requests?|latency|throughput|conversion|accuracy|uptime|agreed|disagreed)\b/) ? 1 : 0)
  ));
  const reflectionScore = Math.min(2, (
    (hasPattern(lower, /\b(learned|realized|next time|differently|in retrospect|looking back|taught me|takeaway)\b/) ? 1 : 0)
    + (hasPattern(lower, /\b(improve|would have|should have|mistake|failure|better)\b/) ? 1 : 0)
  ));

  const scoreMap = { 
    situation: situationScore, 
    task: taskScore, 
    action: actionScore, 
    resultOrReaction: resultOrReactionScore,
    reflection: reflectionScore 
  };

  // Tie-breaker priority (lowest score wins, priority: Reflection > Result > Action > Task > Situation)
  const priorityMap = { reflection: 5, resultOrReaction: 4, action: 3, task: 2, situation: 1 };
  const mainMissingElement = Object.entries(scoreMap)
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return priorityMap[b[0]] - priorityMap[a[0]]; // higher priority is chosen if scores tie
    })[0]?.[0] || 'reflection';

  const totalScore = situationScore + taskScore + actionScore + resultOrReactionScore + reflectionScore;

  return {
    situation: toLabel(situationScore),
    task: toLabel(taskScore),
    action: toLabel(actionScore),
    resultOrReaction: toLabel(resultOrReactionScore),
    reflection: toLabel(reflectionScore),
    scores: scoreMap,
    totalScore,
    maxScore: 10,
    mainMissingElement,
    scoreReason: reflectionScore === 0 && totalScore >= 6
      ? 'The answer contains good context and action but lacks a clear lesson or reflection.'
      : resultOrReactionScore === 0
        ? 'The answer does not include a clear outcome, impact, or stakeholder reaction.'
        : actionScore === 0
          ? 'The answer does not clearly show what the candidate personally did.'
          : totalScore >= 8
            ? 'The answer contains strong STARR evidence with minor room to sharpen detail.'
            : 'The answer has partial STARR evidence and needs clearer context, responsibility, action, result, or reflection.',
  };
};

export const compareStarrBreakdowns = (previous = null, current = null) => {
  if (!previous || !current) return null;
  const previousTotal = Number(previous.totalScore || 0);
  const currentTotal = Number(current.totalScore || 0);
  const keys = ['situation', 'task', 'action', 'resultOrReaction', 'reflection'];
  return {
    scoreChange: `${previousTotal} -> ${currentTotal}`,
    improved: currentTotal > previousTotal,
    mainReason: currentTotal > previousTotal
      ? `You improved ${keys.filter((key) => previous[key] !== current[key]).join(', ') || 'the STARR structure'}.`
      : 'The STARR structure did not improve yet.',
    detailedChange: Object.fromEntries(keys.map((key) => [key, `${previous[key] || 'missing'} -> ${current[key] || 'missing'}`])),
  };
};
