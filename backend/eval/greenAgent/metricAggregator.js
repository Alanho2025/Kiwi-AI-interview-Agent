/**
 * File responsibility: Aggregate scenario-level green-agent evaluation results.
 * Main responsibilities:
 * - Compute benchmark-level averages and weakest cases.
 * - Keep report summaries consistent between the green agent and standalone runners.
 */

export const aggregateEvalResults = ({ results = [], thresholds = {}, label = 'Kiwi Green Agent Eval' } = {}) => {
  const average = results.length ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2)) : 0;
  const weakestCases = results.filter((item) => item.score < Number(thresholds.failBelow || 0.7)).map((item) => ({ id: item.id, score: item.score, failedChecks: item.failedChecks }));
  return {
    label,
    casesRun: results.length,
    evaluationMethod: 'Fixed interview scenario evaluation covering flow validity, question quality, and report grounding. It does not call production routes, databases, voice runtime, or live AI services.',
    average,
    weakestCases,
    thresholds,
    results,
  };
};
