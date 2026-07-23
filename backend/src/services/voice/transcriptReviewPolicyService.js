/**
 * File responsibility: Deterministic transcript review policy.
 * Main responsibilities:
 * - Classify transcript uncertainty without calling external models.
 * - Decide whether correction can be auto-accepted, deferred, or must be confirmed.
 * - Keep raw transcript, correction, and post-turn clarification boundaries explicit.
 */

import { ensureArray, normalizeText, tokenize } from '../../utils/commonHelpers.js';

const DEFAULT_MAX_AUTO_CORRECTIONS = 3;
const DEFAULT_MAX_CHANGED_TOKEN_RATIO = 0.15;

const HIGH_RISK_REASON_CODES = new Set([
  'low_confidence_contentful',
  'numeric_or_metric_change',
  'negation_change',
  'ownership_change',
  'result_or_outcome_change',
  'technical_choice_change',
  'expected_signal_hit',
  'jd_must_have_hit',
  'match_gap_hit',
]);

const NEGATION_TOKENS = new Set([
  'no',
  'not',
  'never',
  'without',
  'cannot',
  'cant',
  "can't",
  'didnt',
  "didn't",
  'dont',
  "don't",
]);

const OWNERSHIP_PATTERNS = [
  /\bown(?:ed|ing)?\b/i,
  /\bled\b/i,
  /\blead\b/i,
  /\bresponsib(?:le|ility)\b/i,
  /\bcoordinat(?:ed|e|ing)\b/i,
  /\bmanaged?\b/i,
];

const RESULT_PATTERNS = [
  /\breduc(?:ed|e|ing)\b/i,
  /\bincreas(?:ed|e|ing)\b/i,
  /\bimprov(?:ed|e|ing)\b/i,
  /\bachiev(?:ed|e|ing)\b/i,
  /\bsaved?\b/i,
  /\bdelivered?\b/i,
  /\bresult\b/i,
  /\boutcome\b/i,
];

const TECHNICAL_CHOICE_PATTERN = /\b(?:chose|choose|selected|prefer(?:red)?|used|picked)\s+([a-z0-9+#.\s-]{2,40}?)\s+(?:over|instead of|rather than)\s+([a-z0-9+#.\s-]{2,40}?)(?:[.,;]| because|\sfor\s|$)/i;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\s*(?:%|percent|hours?|minutes?|seconds?|days?|weeks?|months?|years?|ms|milliseconds|users?|units?|x|times|k|m|million|thousand)?\b/gi;
const CV_JD_SOURCES = new Set(['cv_profile', 'cv_raw_text', 'jd_rubric', 'jd_raw_text', 'structured_jd', 'interview_plan', 'current_question']);
const NUMBER_WORDS = new Map([
  ['zero', 0],
  ['one', 1],
  ['two', 2],
  ['three', 3],
  ['four', 4],
  ['five', 5],
  ['six', 6],
  ['seven', 7],
  ['eight', 8],
  ['nine', 9],
  ['ten', 10],
  ['eleven', 11],
  ['twelve', 12],
  ['thirteen', 13],
  ['fourteen', 14],
  ['fifteen', 15],
  ['sixteen', 16],
  ['seventeen', 17],
  ['eighteen', 18],
  ['nineteen', 19],
  ['twenty', 20],
  ['thirty', 30],
  ['forty', 40],
  ['fifty', 50],
  ['sixty', 60],
  ['seventy', 70],
  ['eighty', 80],
  ['ninety', 90],
  ['hundred', 100],
]);

const unique = (values = []) => [...new Set(values.filter(Boolean))];
const lower = (value = '') => normalizeText(value).toLowerCase();

const correctionList = (calibration = {}) => [
  ...ensureArray(calibration?.corrections),
  ...ensureArray(calibration?.staticCorrections).map((item) => ({
    rawSpan: item.raw || item.pattern || item.rawSpan || '',
    correctedSpan: item.replacement || item.corrected || item.correctedSpan || '',
    source: item.source || 'static_normalization',
    reason: item.reason || 'spelling_or_format',
    scoringImpacting: false,
  })),
];

const extractDigitNumbers = (value = '') => (normalizeText(value).match(NUMBER_PATTERN) || [])
  .map((item) => String(item).match(/\d+(?:\.\d+)?/)?.[0])
  .filter(Boolean);

const extractWordNumbers = (value = '') => {
  const tokens = tokenize(value);
  const numbers = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const current = NUMBER_WORDS.get(tokens[index]);
    if (current === undefined) continue;
    const next = NUMBER_WORDS.get(tokens[index + 1]);
    if (current >= 20 && current < 100 && next > 0 && next < 10) {
      numbers.push(String(current + next));
      index += 1;
      continue;
    }
    numbers.push(String(current));
  }
  return numbers;
};

const extractNumberConcepts = (value = '') => [
  ...extractDigitNumbers(value),
  ...extractWordNumbers(value),
];

const hasDifferentNumbers = (raw = '', proposed = '') => {
  const rawNumbers = extractNumberConcepts(raw).map(lower);
  const proposedNumbers = extractNumberConcepts(proposed).map(lower);
  if (rawNumbers.length !== proposedNumbers.length) return true;
  return rawNumbers.some((number, index) => number !== proposedNumbers[index]);
};

const hasTokenDelta = (raw = '', proposed = '', tokens = NEGATION_TOKENS) => {
  const rawTokens = new Set(tokenize(raw));
  const proposedTokens = new Set(tokenize(proposed));
  return [...tokens].some((token) => rawTokens.has(token) !== proposedTokens.has(token));
};

const patternPresenceChanged = (raw = '', proposed = '', patterns = []) => (
  patterns.some((pattern) => pattern.test(raw) !== pattern.test(proposed))
);

const normalizeChoiceTerm = (value = '') => lower(value)
  .replace(/\b(because|for|with|using|when|if|and)\b.*$/i, '')
  .replace(/[^a-z0-9+#.]+/g, ' ')
  .trim();

const extractTechnicalChoice = (value = '') => {
  const match = normalizeText(value).match(TECHNICAL_CHOICE_PATTERN);
  if (!match) return null;
  return {
    first: normalizeChoiceTerm(match[1]),
    second: normalizeChoiceTerm(match[2]),
  };
};

const hasReversedTechnicalChoice = (raw = '', proposed = '') => {
  const rawChoice = extractTechnicalChoice(raw);
  const proposedChoice = extractTechnicalChoice(proposed);
  if (!rawChoice || !proposedChoice) return false;
  return rawChoice.first
    && rawChoice.second
    && rawChoice.first === proposedChoice.second
    && rawChoice.second === proposedChoice.first;
};

const hasProviderEvidence = (calibration = {}) => Boolean(
  calibration?.nbest?.retained
  && Number(calibration?.nbest?.candidateCount || 0) > 1
);

const hasStaticNormalization = (calibration = {}) => (
  calibration?.decisionType === 'static_normalization'
  || ensureArray(calibration?.staticCorrections).length > 0
);

const hasContextualGlossaryEvidence = (corrections = []) => corrections.some((item) => (
  item?.glossaryTerm || CV_JD_SOURCES.has(item?.source)
));

const isCvJdContextOnly = ({ corrections = [], providerNBest, staticNormalization }) => (
  corrections.length > 0
  && !providerNBest
  && !staticNormalization
  && corrections.every((item) => CV_JD_SOURCES.has(item?.source))
);

const changedTokenRatio = ({ raw = '', proposed = '', corrections = [] } = {}) => {
  const proposedTokenCount = Math.max(1, tokenize(proposed || raw).length);
  const changedTokens = corrections.reduce((sum, item) => (
    sum + Math.max(tokenize(item.rawSpan || '').length, tokenize(item.correctedSpan || '').length, 1)
  ), 0);
  return changedTokens / proposedTokenCount;
};

const signalText = (value) => (Array.isArray(value)
  ? value.map((item) => normalizeText(item)).filter(Boolean).join(' ')
  : normalizeText(value));

const questionExpectedText = (question = {}) => normalizeText([
  question.expectedSignal,
  question.expectedSignals,
  question.metadata?.expectedSignal,
  question.metadata?.expectedSignals,
].map(signalText).join(' '));

const containsQuestionSignal = ({ corrections = [], question = {} } = {}) => {
  const signalTokens = tokenize(questionExpectedText(question)).filter((token) => token.length > 3);
  if (!signalTokens.length) return false;
  const changedText = corrections.map((item) => `${item.rawSpan || ''} ${item.correctedSpan || ''}`).join(' ');
  if (!normalizeText(changedText)) return false;
  const changedTokens = new Set(tokenize(changedText));
  return signalTokens.some((token) => changedTokens.has(token));
};

const hasScoringImpactingCorrection = (corrections = []) => corrections.some((item) => (
  item?.scoringImpacting === true || item?.source === 'current_question'
));

const buildAffectedSpan = ({ raw = '', proposed = '', corrections = [] } = {}) => {
  const first = corrections[0] || {};
  return {
    raw: normalizeText(first.rawSpan || raw).slice(0, 240),
    proposed: normalizeText(first.correctedSpan || proposed).slice(0, 240),
    startChar: Number.isFinite(first.startChar) ? first.startChar : null,
    endChar: Number.isFinite(first.endChar) ? first.endChar : null,
  };
};

const buildDecision = ({
  decisionType,
  riskLevel,
  raw,
  proposed,
  corrections,
  reasonCodes,
  sourceEvidence,
  evidenceImpact,
  userAction,
  scoringPolicy,
  confidence = {},
}) => {
  const decision = {
    schemaVersion: 'transcript_review_policy_v1',
    decisionType,
    riskLevel,
    rawTranscript: raw,
    calibratedTranscript: proposed,
    affectedSpan: buildAffectedSpan({ raw, proposed, corrections }),
    reasonCodes: unique(reasonCodes),
    evidenceImpact,
    sourceEvidence,
    userAction,
    scoringPolicy,
    confidence: {
      stt: Number.isFinite(Number(confidence.stt)) ? Number(confidence.stt) : null,
      policy: Number.isFinite(Number(confidence.policy)) ? Number(confidence.policy) : null,
    },
    guardrail: {
      rawTranscriptPreserved: true,
      answerQualityChanged: false,
      usedCvJdAsSpokenEvidence: false,
      clarificationCanReplaceRawTranscript: false,
    },
    reviewItems: [],
  };

  if (decisionType === 'deferred_review' || decisionType === 'immediate_confirmation') {
    decision.reviewItems = [buildTranscriptReviewItem({ decision })];
  }

  return decision;
};

export const buildTranscriptReviewItem = ({
  decision = {},
  sessionId = null,
  questionId = null,
  turnId = null,
  questionText = '',
} = {}) => ({
  id: `trc-${questionId || turnId || 'pending'}-${decision.decisionType || 'review'}`,
  sessionId,
  questionId,
  turnId,
  createdAt: new Date().toISOString(),
  status: 'pending',
  display: {
    questionText: normalizeText(questionText),
    rawSnippet: normalizeText(decision.affectedSpan?.raw || decision.rawTranscript || '').slice(0, 240),
    proposedSnippet: normalizeText(decision.affectedSpan?.proposed || decision.calibratedTranscript || '').slice(0, 240),
    reasonLabel: decision.reasonCodes?.includes('numeric_or_metric_change')
      ? 'number may be wrong'
      : decision.reasonCodes?.includes('ownership_change')
        ? 'ownership unclear'
        : decision.reasonCodes?.includes('technical_choice_change')
          ? 'technical choice unclear'
          : 'technical term unclear',
    riskLabel: decision.riskLevel === 'high' ? 'High transcript risk' : 'Medium transcript risk',
  },
  allowedActions: [
    'accept_correction',
    'keep_raw',
    'clarify_what_i_said',
  ],
  evidenceBoundary: {
    rawTranscriptImmutable: true,
    correctionCanAffectScoring: decision.scoringPolicy !== 'score_with_reduced_evidence_confidence',
    clarificationCanAffectCoaching: true,
    clarificationCanReplaceRawTranscript: false,
  },
});

export const evaluateTranscriptReviewDecision = ({
  rawTranscript = '',
  calibratedTranscript = '',
  transcriptCalibration = null,
  transcriptGate = null,
  asrConfidence = null,
  currentQuestion = null,
  thresholds = {},
} = {}) => {
  const corrections = correctionList(transcriptCalibration);
  const raw = normalizeText(rawTranscript || transcriptCalibration?.rawTranscript || transcriptCalibration?.selectedTranscript || '');
  const proposed = normalizeText(calibratedTranscript || transcriptCalibration?.calibratedTranscript || transcriptCalibration?.normalizedTranscript || raw);
  const providerNBest = hasProviderEvidence(transcriptCalibration);
  const staticNormalization = hasStaticNormalization(transcriptCalibration);
  const contextualGlossary = hasContextualGlossaryEvidence(corrections);
  const cvJdContextOnly = isCvJdContextOnly({ corrections, providerNBest, staticNormalization });
  const reasonCodes = [];

  if (transcriptGate?.decision === 'confirm_understanding' || transcriptGate?.requiresUnderstandingConfirmation) {
    reasonCodes.push('low_confidence_contentful');
  }

  if (transcriptGate?.decision === 'reject') {
    reasonCodes.push('unusable_transcript');
    return buildDecision({
      decisionType: 'reject_unusable',
      riskLevel: 'unusable',
      raw,
      proposed,
      corrections,
      reasonCodes,
      sourceEvidence: { providerNBest, staticNormalization, contextualGlossary, currentQuestionExpectedSignal: false, jdMustHave: false, matchGap: false, cvJdContextOnly },
      evidenceImpact: 'none',
      userAction: 'repeat_or_clarify',
      scoringPolicy: 'do_not_score',
      confidence: { stt: asrConfidence, policy: 1 },
    });
  }

  if (corrections.length) {
    reasonCodes.push(contextualGlossary ? 'glossary_term_surface' : 'spelling_or_format');
    if (providerNBest) reasonCodes.push('provider_nbest_close_candidate');
  }

  if (cvJdContextOnly) reasonCodes.push('no_provider_evidence');
  if (hasDifferentNumbers(raw, proposed)) reasonCodes.push('numeric_or_metric_change');
  if (hasTokenDelta(raw, proposed)) reasonCodes.push('negation_change');
  if (patternPresenceChanged(raw, proposed, OWNERSHIP_PATTERNS)) reasonCodes.push('ownership_change');
  if (reasonCodes.includes('negation_change')
    && OWNERSHIP_PATTERNS.some((pattern) => pattern.test(raw) || pattern.test(proposed))) {
    reasonCodes.push('ownership_change');
  }
  if (patternPresenceChanged(raw, proposed, RESULT_PATTERNS)) reasonCodes.push('result_or_outcome_change');
  if (hasReversedTechnicalChoice(raw, proposed)) reasonCodes.push('technical_choice_change');
  if (corrections.some((item) => item.scoringImpacting === true)) reasonCodes.push('scoring_impacting_term');

  const currentQuestionExpectedSignal = hasScoringImpactingCorrection(corrections) && containsQuestionSignal({
    corrections,
    question: currentQuestion || {},
  });
  if (currentQuestionExpectedSignal) reasonCodes.push('expected_signal_hit');

  const maxCorrections = thresholds.maxCorrectionsPerAnswerTurn ?? DEFAULT_MAX_AUTO_CORRECTIONS;
  const maxChangedRatio = thresholds.maxChangedTokenRatio ?? DEFAULT_MAX_CHANGED_TOKEN_RATIO;
  const correctionRatio = changedTokenRatio({ raw, proposed, corrections });
  if (corrections.length > maxCorrections || (corrections.length > 1 && correctionRatio > maxChangedRatio)) {
    reasonCodes.push('cumulative_correction_risk');
  }

  const sourceEvidence = {
    providerNBest,
    staticNormalization,
    contextualGlossary,
    currentQuestionExpectedSignal,
    jdMustHave: reasonCodes.includes('jd_must_have_hit'),
    matchGap: reasonCodes.includes('match_gap_hit'),
    cvJdContextOnly,
  };

  const highRisk = reasonCodes.some((code) => HIGH_RISK_REASON_CODES.has(code));
  if (highRisk) {
    return buildDecision({
      decisionType: 'immediate_confirmation',
      riskLevel: 'high',
      raw,
      proposed,
      corrections,
      reasonCodes,
      sourceEvidence,
      evidenceImpact: 'scoring_material',
      userAction: 'confirm_understanding',
      scoringPolicy: 'block_scoring_until_confirmed',
      confidence: { stt: asrConfidence, policy: 0.4 },
    });
  }

  if (reasonCodes.includes('no_provider_evidence') || reasonCodes.includes('cumulative_correction_risk')) {
    return buildDecision({
      decisionType: 'deferred_review',
      riskLevel: 'medium',
      raw,
      proposed,
      corrections,
      reasonCodes,
      sourceEvidence,
      evidenceImpact: 'evidence_confidence_only',
      userAction: 'review_later',
      scoringPolicy: 'score_with_reduced_evidence_confidence',
      confidence: { stt: asrConfidence, policy: 0.65 },
    });
  }

  return buildDecision({
    decisionType: 'auto_accept',
    riskLevel: 'low',
    raw,
    proposed,
    corrections,
    reasonCodes: reasonCodes.length ? reasonCodes : ['no_material_uncertainty'],
    sourceEvidence,
    evidenceImpact: 'none',
    userAction: 'none_required',
    scoringPolicy: 'safe_to_score',
    confidence: { stt: asrConfidence, policy: 0.9 },
  });
};
