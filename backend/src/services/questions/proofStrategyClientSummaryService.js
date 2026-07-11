import { ensureArray, normalizeText } from '../../utils/commonHelpers.js';

const getCoverageIds = (item = {}) => {
  const coverageIds = ensureArray(item.coverageContractIds).filter(Boolean);
  if (coverageIds.length) return coverageIds;
  return item.proofPointId ? [item.proofPointId] : [];
};

const isGapQuestion = (item = {}) => item.evidenceAngle === 'gap_validation'
  || item.questionIntent === 'validate_gap'
  || item.sourceStage === 'match_gap';

const buildFocusArea = (item = {}) => {
  const label = normalizeText(item.topic || item.competency);
  const guidance = item.preparationGuidance || {};
  return {
    label,
    kind: isGapQuestion(item) ? 'gap' : 'experience',
    ...(guidance.proofAngle ? { proofAngle: guidance.proofAngle } : {}),
    ...(guidance.howToUse ? { preparationHint: guidance.howToUse } : {}),
    ...(guidance.risk ? { risk: guidance.risk } : {}),
  };
};

export const buildProofStrategyClientSummary = ({ readiness = {}, poolItems = [] } = {}) => {
  const focusItems = ensureArray(poolItems).filter((item) => (
    item.coveragePriority === 'must_cover' && getCoverageIds(item).length > 0
  ));
  const uniqueFocusAreas = new Map();
  focusItems.forEach((item) => {
    const focusArea = buildFocusArea(item);
    const label = focusArea.label;
    if (!label) return;
    const key = label.toLowerCase();
    if (!uniqueFocusAreas.has(key) || focusArea.kind === 'gap') uniqueFocusAreas.set(key, focusArea);
  });

  const representedCoverageIds = new Set(focusItems.flatMap(getCoverageIds));
  const gapCoverageIds = new Set(focusItems.filter(isGapQuestion).flatMap(getCoverageIds));
  const unresolvedCount = ensureArray(readiness.unresolvedCoverageIds).length;

  return {
    status: readiness.status || readiness.readiness || 'degraded',
    focusAreaCount: representedCoverageIds.size || uniqueFocusAreas.size,
    gapCount: gapCoverageIds.size,
    fallbackQuestionCount: ensureArray(poolItems)
      .filter((item) => item.sourceStage === 'role_fit_fallback').length,
    unresolvedCount,
    focusAreas: [...uniqueFocusAreas.values()].slice(0, 6),
  };
};
