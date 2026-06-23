import { buildQuestionHistory } from '../questions/questionDeduplicationService.js';
import { ensureArray, normalizeKey, normalizeText } from '../../utils/commonHelpers.js';

const AI_ROLES = new Set(['ai', 'assistant', 'interviewer']);
const EXCLUDED_USER_TURN_TYPES = new Set([
  'repair_prompt',
  'transcript_confirmation',
  'transcript_confirmation_response',
  'clarification',
  'repeat_request',
  'system',
  'bridge_acknowledgement',
  'acknowledgement',
]);

const isAcceptedAnswer = (turn = {}) => {
  if (normalizeKey(turn.role) !== 'user' || !normalizeText(turn.text)) return false;
  const metadata = turn.metadata || {};
  const turnType = normalizeKey(metadata.turnType || metadata.turnKind || metadata.sourceType);
  const transcriptStatus = normalizeKey(metadata.transcriptStatus);

  if (metadata.countsAsAnswer === false || metadata.countsAsQuestion === false) return false;
  if (EXCLUDED_USER_TURN_TYPES.has(turnType)) return false;
  if (metadata.transcriptAcceptance?.accepted === false) return false;
  if (['rejected', 'pending', 'unconfirmed'].includes(transcriptStatus)) return false;

  return !turnType
    || ['user_answer', 'candidate_answer'].includes(turnType)
    || metadata.countsAsAnswer === true
    || metadata.countsAsQuestion === true;
};

const isCountableQuestion = (turn = {}) => {
  if (!AI_ROLES.has(normalizeKey(turn.role))) return false;
  return buildQuestionHistory([turn]).countableQuestions.length === 1;
};

const resolveQuestionId = (turn = {}) => turn.questionId
  || turn.id
  || turn.metadata?.questionId
  || turn.metadata?.preparedQuestionId
  || null;

export const buildReportTurnDataset = (transcript = []) => {
  const turns = ensureArray(transcript);
  const questionAnswerPairs = [];
  const countableQuestions = [];
  let pendingQuestion = null;

  for (const turn of turns) {
    if (isCountableQuestion(turn)) {
      countableQuestions.push(turn);
      pendingQuestion = turn;
      continue;
    }

    if (!isAcceptedAnswer(turn) || !pendingQuestion) continue;
    questionAnswerPairs.push({
      questionId: resolveQuestionId(pendingQuestion),
      questionTurn: pendingQuestion,
      answerTurn: turn,
    });
    pendingQuestion = null;
  }

  const acceptedAnswers = questionAnswerPairs.map((item) => item.answerTurn);
  const rawCandidateTurnCount = turns.filter((turn) => normalizeKey(turn.role) === 'user').length;
  const excludedUserTurnCount = Math.max(0, rawCandidateTurnCount - acceptedAnswers.length);
  const repairQuestionCount = buildQuestionHistory(turns).repairQuestions.length;

  return {
    turns,
    questionAnswerPairs,
    acceptedAnswers,
    countableQuestions,
    countableQuestionCount: countableQuestions.length,
    scoredAnswerCount: acceptedAnswers.length,
    rawCandidateTurnCount,
    excludedUserTurnCount,
    repairTurnCount: repairQuestionCount + excludedUserTurnCount,
  };
};

