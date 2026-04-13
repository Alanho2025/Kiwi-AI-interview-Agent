import { containsInText, flattenExplanationItems, includesNormalized, toRangeCheck } from './evalShared.js';

const requirementTexts = (result = {}) => (result.requirementChecks || []).map((item) => `${item.label} ${item.status} ${(item.evidence || []).join(' ')} ${item.notes || ''}`);
const explanationTexts = (result = {}) => ({
  strengths: flattenExplanationItems(result.explanation?.strengths || []),
  gaps: flattenExplanationItems(result.explanation?.gaps || []),
  risks: flattenExplanationItems(result.explanation?.risks || []),
});

export const scoreCvJdMatchCase = (result, expected = {}) => {
  let earned = 0;
  let possible = 0;
  const checks = [];
  const texts = explanationTexts(result);
  const requirementLines = requirementTexts(result);

  const push = (label, passed, weight = 1) => {
    possible += weight;
    if (passed) earned += weight;
    checks.push({ label, passed, weight });
  };

  if (expected.acceptableDecisions?.length) {
    push('decision', expected.acceptableDecisions.includes(result.decision?.label), 3);
  }
  if (expected.scoreRange?.length === 2) {
    push('scoreRange', toRangeCheck(result.overallScore, expected.scoreRange[0], expected.scoreRange[1]), 2);
  }

  for (const keyword of expected.matchedRequirementKeywords || []) {
    push(`matchedRequirement:${keyword}`, requirementLines.some((line) => containsInText(line, keyword) && !containsInText(line, 'not_met')), 2);
  }
  for (const keyword of expected.gapKeywords || []) {
    push(`gap:${keyword}`, texts.gaps.some((line) => containsInText(line, keyword)), 1);
  }
  for (const keyword of expected.riskKeywords || []) {
    push(`risk:${keyword}`, texts.risks.some((line) => containsInText(line, keyword)), 1);
  }
  for (const keyword of expected.strengthKeywords || []) {
    push(`strength:${keyword}`, texts.strengths.some((line) => containsInText(line, keyword)), 1);
  }
  for (const keyword of expected.summaryKeywords || []) {
    push(`summary:${keyword}`, containsInText(result.explanation?.summary, keyword), 1);
  }

  if (expected.enforceDistinctGapRisk !== false) {
    const overlap = (result.explanation?.gaps || []).filter((gap) => includesNormalized((result.explanation?.risks || []).map((risk) => risk.label), gap.label)).length;
    push('distinctGapRisk', overlap === 0, 2);
  }

  if (expected.requireEvidenceForStrengths !== false) {
    const ungrounded = (result.explanation?.strengths || []).filter((item) => !(item.evidence || []).length).length;
    push('groundedStrengths', ungrounded === 0, 1);
  }

  return {
    earned,
    possible,
    score: possible ? Number((earned / possible).toFixed(2)) : 1,
    checks,
  };
};
