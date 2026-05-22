/**
 * File responsibility: Deterministic baseline comparison evaluator.
 * Main responsibilities:
 * - Compare a generic ChatGPT-style coach baseline against Kiwi Agent output.
 * - Score both outputs with the same transparent rubric.
 * - Produce report-ready evidence for baseline comparison in the final paper.
 */

const normalize = (value = '') => String(value || '').toLowerCase();

const countMatches = (text = '', terms = []) => terms.filter((term) => normalize(text).includes(normalize(term))).length;

const scoreTerms = ({ text = '', terms = [] } = {}) => {
  if (!terms.length) return 1;
  return Number((countMatches(text, terms) / terms.length).toFixed(2));
};

const unsupportedClaimPenalty = ({ text = '', forbiddenClaims = [] } = {}) => {
  const hits = forbiddenClaims.filter((claim) => normalize(text).includes(normalize(claim)));
  return {
    hits,
    penalty: Number((hits.length * 0.15).toFixed(2)),
  };
};

export const scoreInterviewCoachOutput = ({ output = '', expected = {} } = {}) => {
  const evidenceGrounding = Number(((
    scoreTerms({ text: output, terms: expected.cvEvidenceTerms || [] }) +
    scoreTerms({ text: output, terms: expected.jdEvidenceTerms || [] })
  ) / 2).toFixed(2));

  const starCoverage = scoreTerms({ text: output, terms: expected.starTerms || [] });
  const roleRelevance = scoreTerms({ text: output, terms: expected.roleTerms || [] });
  const nzContextualisation = scoreTerms({ text: output, terms: expected.nzTerms || [] });
  const adaptiveness = scoreTerms({ text: output, terms: expected.adaptiveTerms || [] });
  const unsupported = unsupportedClaimPenalty({ text: output, forbiddenClaims: expected.forbiddenClaims || [] });

  const weightedScore = (
    evidenceGrounding * 0.3 +
    starCoverage * 0.2 +
    roleRelevance * 0.2 +
    nzContextualisation * 0.15 +
    adaptiveness * 0.15
  ) - unsupported.penalty;

  const score = Number(Math.max(0, Math.min(1, weightedScore)).toFixed(2));
  const failedChecks = [];
  if (evidenceGrounding < 0.7) failedChecks.push('weak_evidence_grounding');
  if (starCoverage < 0.7) failedChecks.push('weak_star_coverage');
  if (roleRelevance < 0.7) failedChecks.push('weak_role_relevance');
  if (nzContextualisation < 0.7) failedChecks.push('weak_nz_contextualisation');
  if (adaptiveness < 0.7) failedChecks.push('weak_adaptiveness');
  if (unsupported.hits.length) failedChecks.push('unsupported_claims_present');

  return {
    score,
    subScores: {
      evidenceGrounding,
      starCoverage,
      roleRelevance,
      nzContextualisation,
      adaptiveness,
      unsupportedClaimPenalty: unsupported.penalty,
    },
    unsupportedClaims: unsupported.hits,
    failedChecks,
  };
};

export const runBaselineComparisonCase = (scenario = {}) => {
  const generic = scoreInterviewCoachOutput({ output: scenario.genericBaselineOutput, expected: scenario.expected });
  const kiwi = scoreInterviewCoachOutput({ output: scenario.kiwiAgentOutput, expected: scenario.expected });
  const scoreGain = Number((kiwi.score - generic.score).toFixed(2));

  return {
    id: scenario.id,
    role: scenario.role,
    baselineModel: scenario.baselineModel || 'ChatGPT GPT-5.5 Thinking generated baseline fixture',
    baselinePromptType: scenario.baselinePromptType || 'generic interview coach prompt',
    score: kiwi.score,
    baselineScore: generic.score,
    scoreGain,
    passed: kiwi.score >= generic.score,
    subScores: kiwi.subScores,
    baselineSubScores: generic.subScores,
    failedChecks: kiwi.failedChecks,
    baselineFailedChecks: generic.failedChecks,
    diagnostics: {
      genericUnsupportedClaims: generic.unsupportedClaims,
      kiwiUnsupportedClaims: kiwi.unsupportedClaims,
    },
  };
};

export const summarizeBaselineComparison = ({ results = [], thresholds = {}, label = 'Baseline Comparison Eval' } = {}) => {
  const average = results.length
    ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2))
    : 0;
  const baselineAverage = results.length
    ? Number((results.reduce((sum, item) => sum + item.baselineScore, 0) / results.length).toFixed(2))
    : 0;
  const averageGain = Number((average - baselineAverage).toFixed(2));
  const winRate = results.length
    ? Number((results.filter((item) => item.score >= item.baselineScore).length / results.length).toFixed(2))
    : 0;
  const weakestCases = results
    .filter((item) => item.score < Number(thresholds.failBelow || 0.7))
    .map((item) => ({ id: item.id, score: item.score, failedChecks: item.failedChecks }));
  const baselineModels = Array.from(new Set(results.map((item) => item.baselineModel).filter(Boolean)));

  return {
    label,
    casesRun: results.length,
    baselineModels,
    average,
    baselineAverage,
    averageGain,
    winRate,
    weakestCases,
    thresholds,
    results,
  };
};
