import { normalizeText } from '../../utils/commonHelpers.js';

const matches = (text, expression) => expression.test(text);

export const extractAnswerEvidenceSignals = (answer = '') => {
  const text = normalizeText(answer);
  const lower = text.toLowerCase();
  const hasPastContext = matches(lower, /\b(?:in|during|when|at|on)\b(?:\s+\w+){0,5}\s+\b(?:previous role|role|project|application|app|team|company|station|workflow|pilot|incident|support)\b|\b(?:at the beginning|started at|my original role)\b/);
  const hasPersonalAction = matches(lower, /\bi\s+(?:personally\s+)?(?:tried|used|built|designed|implemented|led|owned|fixed|improved|handled|created|deployed|checked|tested|retested|coordinated|traced|analysed|analyzed|shared|gave|asked|found|changed|clarified|simplified|separated|refactored|automated|consulted|measured|worked)\b/);
  const hasValidation = matches(lower, /\b(?:validated|tested|retested|checked|measured|compared|reviewed|analysed|analyzed|traced|experiment(?:ed)?)\b/);
  const metricMatches = [...text.matchAll(/\b\d+(?:\.\d+)?\s*(?:%|percent|seconds?|minutes?|hours?|units?|requests?|points?|times?)(?!\w)/gi)]
    .map((match) => match[0]);
  const hasOutcome = matches(lower, /\b(?:reduced|decreased|increased|improved|brought|cut|raised|resolved|delivered|achieved|dropped|fell|saved)\b/);
  const hasFutureIntent = matches(lower, /\b(?:i would|i could|i can|i will|i plan to)\b/);
  const hasFirstPersonReflection = matches(lower, /\b(?:i learned|i learnt|i realised|i realized|this taught me|next time i would|i would do .* differently|i can apply|i can bring)\b/);

  return {
    hasPastContext,
    hasPersonalAction,
    hasValidation,
    hasOutcome,
    metricMatches,
    hasFutureIntent,
    hasFirstPersonReflection,
    isDirectPastExperience: hasPastContext && (hasPersonalAction || hasOutcome),
    isHypotheticalOnly: hasFutureIntent && !(hasPastContext && (hasPersonalAction || hasOutcome)),
  };
};

