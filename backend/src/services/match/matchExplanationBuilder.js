import { ensureArray } from '../../utils/commonHelpers.js';

export const buildMatchExplanation = ({ strengths = [], gaps = [], risks = [] } = {}) => {
  const safeStrengths = ensureArray(strengths).slice(0, 6);
  const safeGaps = ensureArray(gaps).slice(0, 6);
  const safeRisks = ensureArray(risks).slice(0, 6);

  const summaryParts = [];
  if (safeStrengths.length) {
    summaryParts.push(`Strongest aligned evidence: ${safeStrengths.slice(0, 2).join('; ')}.`);
  }
  if (safeGaps.length) {
    summaryParts.push(`Most visible gaps: ${safeGaps.slice(0, 2).join('; ')}.`);
  }
  if (safeRisks.length) {
    summaryParts.push(`Main validation risks: ${safeRisks.slice(0, 2).join('; ')}.`);
  }

  return {
    strengths: safeStrengths,
    gaps: safeGaps,
    risks: safeRisks,
    summary: summaryParts.join(' ').trim(),
  };
};
