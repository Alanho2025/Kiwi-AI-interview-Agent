import { normalizeText, tokenize } from '../../utils/commonHelpers.js';
import { extractAnswerEvidenceSignals } from '../report/answerEvidenceSignalService.js';

const hasPattern = (text = '', pattern) => pattern.test(String(text || '').toLowerCase());

const toLabel = (score = 0) => (score >= 2 ? 'clear' : score >= 1 ? 'partial' : 'missing');

export const analyzeStarrBreakdown = (answerText = '') => {
  const text = normalizeText(answerText);
  const lower = text.toLowerCase();
  const tokens = tokenize(text);
  const wordCount = tokens.length;
  const signals = extractAnswerEvidenceSignals(text);

  const situationScore = Math.min(2, (
    (wordCount >= 18 ? 1 : 0)
    + (hasPattern(lower, /\b(project|role|team|client|workflow|system|feature|deadline|incident|when|during|at)\b/) ? 1 : 0)
  ));
  const taskScore = Math.min(2, (
    (hasPattern(lower, /\b(goal|need|needed|responsible|task|requirement|challenge|problem|issue|target|objective|understand|handle|support)\b/) ? 1 : 0)
    + (hasPattern(lower, /\b(had to|need to|needed to|my role|i was responsible|asked to|we needed|i need|i had|my task)\b/) ? 1 : 0)
  ));
  const actionScore = Math.min(2, (
    (signals.hasPersonalAction ? 1 : 0)
    + (signals.hasValidation || hasPattern(lower, /\b(?:debugged|separated|refactored|automated|researched)\b/) ? 1 : 0)
  ));
  const resultOrReactionScore = Math.min(2, (
    (signals.hasOutcome ? 1 : 0)
    + (signals.metricMatches.length > 0 || hasPattern(lower, /\b(?:agreed|disagreed|satisfied)\b/) ? 1 : 0)
  ));
  const reflectionScore = Math.min(2, (
    (signals.hasFirstPersonReflection ? 1 : 0)
    + (hasPattern(lower, /\b(?:i would have|i should have|my mistake|my failure|in retrospect i|looking back i)\b/) ? 1 : 0)
  ));

  const scoreMap = { 
    situation: situationScore, 
    task: taskScore, 
    action: actionScore, 
    resultOrReaction: resultOrReactionScore,
    reflection: reflectionScore 
  };

  // Pick the most important missing core evidence first. Reflection is useful,
  // but it should not hide missing situation, task, action, or result evidence.
  const priorityMap = { resultOrReaction: 5, action: 4, task: 3, situation: 2, reflection: 1 };
  const mainMissingElement = Object.entries(scoreMap)
    .sort((a, b) => {
      if (a[1] !== b[1]) return a[1] - b[1];
      return priorityMap[b[0]] - priorityMap[a[0]];
    })[0]?.[0] || 'resultOrReaction';

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
    scoreReason: situationScore === 0 || taskScore === 0 || actionScore === 0 || resultOrReactionScore === 0
      ? 'The answer needs a clearer situation, task, action, and result before the reflection can be useful.'
      : reflectionScore === 0
        ? 'The answer contains the core STAR evidence but lacks a clear lesson or reflection.'
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
