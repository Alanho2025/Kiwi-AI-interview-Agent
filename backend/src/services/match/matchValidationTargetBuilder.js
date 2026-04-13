const ensureArray = (value) => (Array.isArray(value) ? value : []);
const unique = (items = []) => [...new Set(items.map((item) => String(item || '').trim()).filter(Boolean))];

export const buildMatchValidationTargets = ({ requirementChecks = [], explanation = {}, questionPlanHints = {} } = {}) => {
  const hardFailures = ensureArray(requirementChecks)
    .filter((item) => item?.required && item?.passed === false)
    .map((item) => item.requirement || item.label || item.skill);
  const riskyClaims = ensureArray(explanation.risks)
    .filter((item) => /claim|proof|commercial|production|direct/i.test(String(item || '')));

  return unique([
    ...hardFailures,
    ...ensureArray(questionPlanHints.followUpTargets),
    ...riskyClaims,
  ]).slice(0, 8);
};
