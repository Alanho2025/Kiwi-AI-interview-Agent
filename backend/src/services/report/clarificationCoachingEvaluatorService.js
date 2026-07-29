import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';

const ASSUMPTION_PATTERN = /^(?:for this answer[, ]+)?(?:i(?:'|’)?ll|i will|let me)\s+assume\b/i;

const resolveRootQuestionId = (turn = {}) => (
  turn?.metadata?.rootQuestionId ||
  turn?.questionId ||
  turn?.metadata?.questionId ||
  turn?.metadata?.preparedQuestionId ||
  null
);

export const evaluateTurnClarificationCoaching = ({
  questionTurn = {},
  answerTurn = {},
  transcript = [],
} = {}) => {
  const questionMetadata = questionTurn.metadata || {};
  const answerMetadata = answerTurn.metadata || {};
  const ambiguityMode = questionMetadata.ambiguityMode || 'none';
  const rootQuestionId = resolveRootQuestionId(questionTurn);
  const expectedSignals = ensureArray(questionMetadata.expectedSignals || questionMetadata.testedSignals).map(normalizeKey);

  const fullTranscript = ensureArray(transcript);

  const scopeResponseTurn = fullTranscript.find((turn) => {
    if (resolveRootQuestionId(turn) !== rootQuestionId) return false;
    const metadata = turn.metadata || {};
    const turnType = normalizeKey(metadata.turnType || metadata.turnKind || metadata.sourceType);
    return (
      turnType === 'question_scope_clarification' &&
      metadata.scopeResponseReason !== 'prepared_context_unavailable'
    );
  });

  const degradedRephraseTurn = fullTranscript.find((turn) => {
    if (resolveRootQuestionId(turn) !== rootQuestionId) return false;
    const metadata = turn.metadata || {};
    return metadata.scopeResponseReason === 'prepared_context_unavailable';
  });

  const answerText = normalizeText(answerTurn.text || '');
  const hasExplicitAssumption = (
    answerMetadata.scopeFraming === 'explicit_assumption' ||
    ASSUMPTION_PATTERN.test(answerText)
  );

  const requiresClarificationSignal = expectedSignals.some((signal) => (
    signal.includes('clarif') || signal.includes('scope') || signal.includes('assumption')
  ));

  if (scopeResponseTurn) {
    return {
      clarificationStatus: 'scope_confirmed',
      coachingFeedback: 'You confirmed the question scope before answering, which helped make your response targeted and relevant.',
      actionableTip: 'Continue seeking scope confirmation when facing broad technical or scenario questions.',
    };
  }

  if (hasExplicitAssumption) {
    return {
      clarificationStatus: 'explicit_assumption',
      coachingFeedback: 'You clearly stated your working assumption upfront, helping the interviewer follow your thought process.',
      actionableTip: 'Stating explicit assumptions is an effective strategy for handling ambiguous interview scenarios.',
    };
  }

  if (degradedRephraseTurn) {
    return {
      clarificationStatus: 'degraded_rephrase',
      coachingFeedback: 'You attempted to clarify the scope, but the specific context was unavailable, so a fallback rephrase was provided.',
      actionableTip: 'When specific scenario context is unavailable, state a clear working assumption before answering.',
    };
  }

  if (['bounded_scenario', 'open_scope_probe'].includes(ambiguityMode) || requiresClarificationSignal) {
    return {
      clarificationStatus: 'no_assumption_stated',
      coachingFeedback: 'Your response addressed the topic, but for open-scoped questions, stating your assumed context upfront makes your answer safer and clearer.',
      actionableTip: 'Before answering open-ended technical questions, take a moment to state your assumed scale, environment, or constraints.',
    };
  }

  return {
    clarificationStatus: 'none',
    coachingFeedback: 'The question scope was clear and your answer directly addressed the requested evidence.',
    actionableTip: null,
  };
};
