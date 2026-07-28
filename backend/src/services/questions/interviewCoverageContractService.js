import { ensureArray } from '../../utils/commonHelpers.js';

const NON_COUNTABLE_TURN_TYPES = new Set([
  'repair_prompt',
  'transcript_confirmation',
  'clarification',
  'question_scope_clarification',
  'repeat_request',
  'system',
  'barge_in_acknowledgement',
]);

const isCountableQuestionTurn = (turn = {}) => {
  if (turn.role !== 'ai') return false;
  const metadata = turn.metadata || {};
  if (metadata.countsAsQuestion === false) return false;
  return !NON_COUNTABLE_TURN_TYPES.has(metadata.turnType);
};

const getPreparedQuestionId = (turn = {}) => turn.metadata?.preparedQuestionId
  || turn.metadata?.questionDecision?.preparedQuestionId
  || turn.questionId
  || turn.metadata?.questionId
  || null;

const itemCoversContract = (item = {}, coverage = {}) => {
  const coverageIds = ensureArray(item.coverageContractIds);
  return coverageIds.includes(coverage.coverageId)
    || item.proofPointId === coverage.coverageId
    || Boolean(coverage.roleIntentId && ensureArray(item.testedRoleIntentIds).includes(coverage.roleIntentId));
};

export const trackInterviewCoverage = ({ proofStrategy = {}, transcript = [], poolItems = [] } = {}) => {
  const mustCover = ensureArray(proofStrategy.mustCover);
  if (!mustCover.length) return [];

  const poolById = new Map(ensureArray(poolItems).map((item) => [item.questionId, item]));
  const askedPreparedQuestionIds = new Set(ensureArray(transcript)
    .filter(isCountableQuestionTurn)
    .map(getPreparedQuestionId)
    .filter(Boolean));

  return mustCover.map((coverage) => {
    if (coverage.status === 'degraded') {
      return { ...coverage, askedQuestionCount: 0, status: 'degraded' };
    }

    const candidateItems = ensureArray(poolItems).filter((item) => itemCoversContract(item, coverage));
    const askedQuestionCount = [...askedPreparedQuestionIds]
      .map((questionId) => poolById.get(questionId))
      .filter((item) => item && itemCoversContract(item, coverage))
      .length;
    const minimumQuestions = Math.max(1, Number(coverage.minQuestions) || 1);
    const hasEnoughCandidates = candidateItems.length >= minimumQuestions;
    const status = askedQuestionCount >= minimumQuestions
      ? 'covered'
      : hasEnoughCandidates ? 'pending' : 'unresolved';

    return {
      ...coverage,
      askedQuestionCount,
      status,
    };
  });
};
