import { ensureArray } from '../../utils/commonHelpers.js';

/**
 * File responsibility: Service module.
 * Main responsibilities:
 * - Calculate and track candidate evidence usage in asked questions.
 */

export const getEvidenceUsageCounts = ({ transcript = [] } = {}) => {
  const evidenceCounts = {};
  const angleCounts = {};

  ensureArray(transcript)
    .filter(turn => turn.role === 'ai')
    .forEach(turn => {
      const evIds = ensureArray(
        turn.metadata?.recommendedEvidenceIds || 
        turn.metadata?.questionDecision?.recommendedEvidenceIds ||
        turn.metadata?.cvEvidenceRefs?.map(r => r.id || r.evidenceId)
      );
      evIds.forEach(id => {
        if (id) {
          evidenceCounts[id] = (evidenceCounts[id] || 0) + 1;
        }
      });

      const angle = turn.metadata?.evidenceAngle || turn.metadata?.questionDecision?.evidenceAngle;
      if (angle) {
        angleCounts[angle] = (angleCounts[angle] || 0) + 1;
      }
    });

  return { evidenceCounts, angleCounts };
};
