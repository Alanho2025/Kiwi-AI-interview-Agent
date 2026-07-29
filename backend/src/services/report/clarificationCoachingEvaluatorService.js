import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';

const ASSUMPTION_PATTERN = /^(?:for this answer[, ]+)?(?:i(?:'|’)?ll|i will|let me)\s+assume\b/i;

const isScopeClarificationTurn = (turn = {}) => {
  const metadata = turn.metadata || {};
  const turnType = normalizeKey(metadata.turnType || metadata.turnKind || metadata.sourceType);
  return (
    turnType === 'question_scope_clarification' ||
    turnType === 'question_scope_clarification_request' ||
    Boolean(metadata.scopeResponseReason)
  );
};

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

  const fullTranscript = ensureArray(transcript);

  const hasScopeClarification = fullTranscript.some((turn) => (
    isScopeClarificationTurn(turn) &&
    resolveRootQuestionId(turn) === rootQuestionId
  ));

  const answerText = normalizeText(answerTurn.text || '');
  const hasExplicitAssumption = (
    answerMetadata.scopeFraming === 'explicit_assumption' ||
    ASSUMPTION_PATTERN.test(answerText)
  );

  if (hasScopeClarification) {
    return {
      clarificationStatus: 'scope_confirmed',
      ambiguityMode,
      coachingFeedback: 'You confirmed the question scope before answering, which helped make your response targeted and relevant.',
      actionableTip: 'Continue seeking scope confirmation when facing broad technical or scenario questions.',
    };
  }

  if (hasExplicitAssumption) {
    return {
      clarificationStatus: 'explicit_assumption',
      ambiguityMode,
      coachingFeedback: 'You clearly stated your working assumption upfront, helping the interviewer follow your thought process.',
      actionableTip: 'Stating explicit assumptions is an effective strategy for handling ambiguous interview scenarios.',
    };
  }

  if (['bounded_scenario', 'open_scope_probe'].includes(ambiguityMode)) {
    return {
      clarificationStatus: 'no_assumption_stated',
      ambiguityMode,
      coachingFeedback: 'Your response addressed the topic, but for open-scoped questions, stating your assumed context upfront makes your answer safer and clearer.',
      actionableTip: 'Before answering open-ended technical questions, take a moment to state your assumed scale, environment, or constraints.',
    };
  }

  return {
    clarificationStatus: 'none',
    ambiguityMode: 'none',
    coachingFeedback: 'The question scope was clear and your answer directly addressed the requested evidence.',
    actionableTip: null,
  };
};
