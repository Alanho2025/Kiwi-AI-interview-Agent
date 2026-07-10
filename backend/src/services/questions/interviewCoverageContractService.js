import { ensureArray } from '../../utils/commonHelpers.js';

/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Reconcile and track active interview coverage contracts.
 */

export const trackInterviewCoverage = ({ proofStrategy = {}, transcript = [], poolItems = [] } = {}) => {
  const mustCover = ensureArray(proofStrategy.mustCover || []);
  if (!mustCover.length) return [];

  const poolById = new Map(ensureArray(poolItems).map(item => [item.questionId, item]));

  const askedQuestionIds = new Set();
  ensureArray(transcript)
    .filter(turn => turn.role === 'ai')
    .forEach(turn => {
      const qId = turn.questionId 
        || turn.metadata?.questionId 
        || turn.metadata?.preparedQuestionId 
        || turn.metadata?.questionDecision?.preparedQuestionId;
      if (qId) askedQuestionIds.add(qId);
    });

  return mustCover.map((coverage) => {
    let isCovered = false;
    for (const qId of askedQuestionIds) {
      const qItem = poolById.get(qId);
      if (!qItem) continue;
      
      if (
        (qItem.proofPointId && qItem.proofPointId === coverage.coverageId) ||
        (coverage.roleIntentId && ensureArray(qItem.testedRoleIntentIds).includes(coverage.roleIntentId))
      ) {
        isCovered = true;
        break;
      }
    }

    return {
      ...coverage,
      status: isCovered ? 'covered' : 'pending',
    };
  });
};
