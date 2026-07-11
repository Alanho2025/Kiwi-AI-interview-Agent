import crypto from 'node:crypto';
import { performance } from 'node:perf_hooks';

import {
  RETRIEVAL_CONFIG,
  rankInMemoryRetrievalCorpus,
} from '../../src/services/ragRetrievalService.js';
import {
  averageMetrics,
  averageScores,
  buildMetricSlices,
  roundMetric,
} from './evaluationSummary.js';

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};

const discountedGain = (rankedChunkIds = [], relevantIds = new Set()) => rankedChunkIds.reduce(
  (sum, chunkId, index) => sum + (relevantIds.has(chunkId) ? 1 / Math.log2(index + 2) : 0),
  0,
);

export const createEvaluationFingerprint = (input = {}) => {
  const serialized = JSON.stringify(stableValue(input));
  return `sha256:${crypto.createHash('sha256').update(serialized).digest('hex')}`;
};

export const computeRetrievalMetrics = ({
  rankedChunkIds = [],
  relevantChunkIds = [],
  forbiddenChunkIds = [],
  topK = rankedChunkIds.length || 1,
  sourcePolicyPassed = true,
} = {}) => {
  const rankedAtK = rankedChunkIds.slice(0, topK);
  const relevantIds = new Set(relevantChunkIds);
  const forbiddenIds = new Set(forbiddenChunkIds);
  const relevantHitCount = rankedAtK.filter((chunkId) => relevantIds.has(chunkId)).length;
  const forbiddenHitCount = rankedAtK.filter((chunkId) => forbiddenIds.has(chunkId)).length;
  const firstRelevantIndex = rankedAtK.findIndex((chunkId) => relevantIds.has(chunkId));
  const idealRanking = relevantChunkIds.slice(0, topK);
  const idealDiscountedGain = discountedGain(idealRanking, relevantIds);

  return {
    precisionAtK: roundMetric(relevantHitCount / Math.max(1, topK)),
    recallAtK: relevantIds.size ? roundMetric(relevantHitCount / relevantIds.size) : 1,
    mrr: firstRelevantIndex >= 0 ? roundMetric(1 / (firstRelevantIndex + 1)) : 0,
    ndcg: idealDiscountedGain
      ? roundMetric(discountedGain(rankedAtK, relevantIds) / idealDiscountedGain)
      : 1,
    forbiddenEvidenceRetrievalRate: roundMetric(forbiddenHitCount / Math.max(1, topK)),
    sourcePolicyAccuracy: sourcePolicyPassed ? 1 : 0,
  };
};

export const evaluateRuntimeRetrievalCase = async (evaluationCase = {}) => {
  const startedAt = performance.now();
  const topK = Number(evaluationCase.topK || 5);
  const rankedChunks = await rankInMemoryRetrievalCorpus({
    query: evaluationCase.query,
    corpus: evaluationCase.corpus,
    sourceTypes: evaluationCase.sourceTypes,
    topK,
    minimumScore: evaluationCase.minimumScore ?? 0.05,
  });
  const allowedSources = new Set(evaluationCase.sourceTypes || []);
  const sourcePolicyPassed = rankedChunks.every((chunk) => (
    !allowedSources.size || allowedSources.has(chunk.sourceType)
  ));
  const configFingerprint = createEvaluationFingerprint({
    datasetVersion: evaluationCase.datasetVersion,
    retrievalConfig: RETRIEVAL_CONFIG,
    topK,
    minimumScore: evaluationCase.minimumScore ?? 0.05,
  });

  const metrics = computeRetrievalMetrics({
    rankedChunkIds: rankedChunks.map((chunk) => chunk.chunkId),
    relevantChunkIds: evaluationCase.relevantChunkIds,
    forbiddenChunkIds: evaluationCase.forbiddenChunkIds,
    topK,
    sourcePolicyPassed,
  });
  const score = roundMetric((
    metrics.precisionAtK
    + metrics.recallAtK
    + metrics.mrr
    + metrics.ndcg
    + (1 - metrics.forbiddenEvidenceRetrievalRate)
    + metrics.sourcePolicyAccuracy
  ) / 6);

  return {
    schemaVersion: 'retrieval_case_result_v1',
    caseId: evaluationCase.caseId,
    datasetVersion: evaluationCase.datasetVersion,
    labels: evaluationCase.labels || {},
    query: evaluationCase.query,
    sourceTypes: evaluationCase.sourceTypes || [],
    configFingerprint,
    latencyMs: roundMetric(performance.now() - startedAt),
    rankedChunks,
    metrics,
    score,
    expectedFallback: evaluationCase.expectedFallback ?? null,
  };
};

export const runRuntimeRetrievalCases = async (dataset = {}) => {
  const results = await Promise.all((dataset.cases || []).map((evaluationCase) => (
    evaluateRuntimeRetrievalCase({
      ...evaluationCase,
      datasetVersion: evaluationCase.datasetVersion || dataset.datasetVersion,
    })
  )));

  return {
    schemaVersion: 'retrieval_eval_report_v1',
    datasetVersion: dataset.datasetVersion,
    configFingerprint: createEvaluationFingerprint({
      datasetVersion: dataset.datasetVersion,
      retrievalConfig: RETRIEVAL_CONFIG,
    }),
    generatedAt: new Date().toISOString(),
    casesRun: results.length,
    average: averageScores(results),
    metrics: averageMetrics(results),
    slices: buildMetricSlices(results),
    results,
  };
};
