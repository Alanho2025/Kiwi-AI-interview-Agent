const normalize = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9+#\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const textSupportsClaim = (context = '', claim = '') => {
  const normalizedContext = normalize(context);
  const normalizedClaim = normalize(claim);
  if (!normalizedClaim) return false;
  if (normalizedContext.includes(normalizedClaim)) return true;
  const claimTokens = normalizedClaim.split(' ').filter((token) => token.length > 2);
  if (!claimTokens.length) return false;
  const supportedCount = claimTokens.filter((token) => normalizedContext.includes(token)).length;
  return supportedCount / claimTokens.length >= 0.75;
};

const outputIncludesClaim = (outputText = '', claim = '') => (
  normalize(outputText).includes(normalize(claim))
);

export const evaluateGenerationGroundingCase = (evaluationCase = {}) => {
  const retrieval = evaluationCase.retrieval || {};
  const reference = evaluationCase.reference || {};
  const output = evaluationCase.output || {};
  const chunkContext = new Map((retrieval.chunkIds || []).map((chunkId, index) => [
    chunkId,
    retrieval.contexts?.[index] || '',
  ]));
  const claims = output.claims || [];

  const claimResults = claims.map((claim) => {
    const evidenceChunkIds = claim.evidenceChunkIds || [];
    const allowedSourceTypes = new Set(
      reference.claimSourcePolicy?.[claim.claimClass]
      || reference.allowedClaimSourceTypes
      || [],
    );
    const supported = evidenceChunkIds.some((chunkId) => {
      const sourceType = retrieval.contextSources?.[chunkId];
      const sourceAllowed = !allowedSourceTypes.size || allowedSourceTypes.has(sourceType);
      return sourceAllowed && textSupportsClaim(chunkContext.get(chunkId), claim.text);
    });

    return {
      text: claim.text,
      claimClass: claim.claimClass || 'unspecified',
      evidenceChunkIds,
      supported,
    };
  });

  const supportedCount = claimResults.filter((claim) => claim.supported).length;
  const unsupportedClaims = claimResults.filter((claim) => !claim.supported).map((claim) => claim.text);
  const forbiddenClaimsFound = (reference.forbiddenClaims || [])
    .filter((claim) => outputIncludesClaim(output.text, claim));
  const requiredClaimHits = (reference.requiredClaims || [])
    .filter((claim) => outputIncludesClaim(output.text, claim));
  const relevantClaimCount = claims.filter((claim) => (
    (reference.requiredClaims || []).some((required) => (
      outputIncludesClaim(claim.text, required) || outputIncludesClaim(required, claim.text)
    ))
    || claimResults.find((result) => result.text === claim.text)?.supported
  )).length;
  const claimCount = Math.max(1, claims.length);

  const metrics = {
    claimFaithfulness: roundMetric(supportedCount / claimCount),
    requiredClaimCoverage: reference.requiredClaims?.length
      ? roundMetric(requiredClaimHits.length / reference.requiredClaims.length)
      : 1,
    responseRelevancy: roundMetric(relevantClaimCount / claimCount),
    noiseSensitivity: roundMetric(unsupportedClaims.length / claimCount),
    unsupportedClaimFailureRate: roundMetric(unsupportedClaims.length / claimCount),
  };
  const score = roundMetric((
    metrics.claimFaithfulness
    + metrics.requiredClaimCoverage
    + metrics.responseRelevancy
    + (1 - metrics.noiseSensitivity)
    + (1 - metrics.unsupportedClaimFailureRate)
  ) / 5);

  return {
    schemaVersion: 'generation_grounding_case_result_v1',
    caseId: evaluationCase.caseId,
    datasetVersion: evaluationCase.datasetVersion,
    configFingerprint: retrieval.configFingerprint,
    labels: evaluationCase.labels || {},
    metrics,
    score,
    claims: claimResults,
    unsupportedClaims,
    forbiddenClaimsFound,
  };
};

export const runGenerationGroundingCases = (dataset = {}) => {
  const results = (dataset.cases || []).map((evaluationCase) => evaluateGenerationGroundingCase({
    ...evaluationCase,
    datasetVersion: evaluationCase.datasetVersion || dataset.datasetVersion,
  }));

  return {
    schemaVersion: 'generation_grounding_eval_report_v1',
    datasetVersion: dataset.datasetVersion,
    generatedAt: new Date().toISOString(),
    casesRun: results.length,
    average: averageScores(results),
    metrics: averageMetrics(results),
    slices: buildMetricSlices(results),
    results,
  };
};
import {
  averageMetrics,
  averageScores,
  buildMetricSlices,
  roundMetric,
} from './evaluationSummary.js';
