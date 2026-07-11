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
    .filter(turn => turn.role === 'ai' && turn.metadata?.countsAsQuestion !== false)
    .forEach(turn => {
      const metadata = turn.metadata || {};
      const rankTrace = metadata.rankTrace || metadata.questionDecision?.rankTrace || {};
      const evIds = [...new Set([
        ...ensureArray(metadata.recommendedEvidenceIds),
        ...ensureArray(metadata.questionDecision?.recommendedEvidenceIds),
        ...ensureArray(rankTrace.recommendedEvidenceIds),
        ...ensureArray(metadata.cvEvidenceRefs).map(r => r?.id || r?.evidenceId),
      ].filter(Boolean))];
      evIds.forEach(id => {
        if (id) {
          evidenceCounts[id] = (evidenceCounts[id] || 0) + 1;
        }
      });

      const angle = metadata.evidenceAngle
        || metadata.questionDecision?.evidenceAngle
        || rankTrace.evidenceAngle;
      if (angle) {
        angleCounts[angle] = (angleCounts[angle] || 0) + 1;
      }
    });

  return { evidenceCounts, angleCounts };
};
