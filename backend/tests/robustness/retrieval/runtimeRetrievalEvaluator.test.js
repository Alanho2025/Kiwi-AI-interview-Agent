import { describe, expect, it } from 'vitest';

import {
  RETRIEVAL_CONFIG,
  rankInMemoryRetrievalCorpus,
  rankRetrievalCandidates,
} from '../../../src/services/ragRetrievalService.js';
import {
  computeRetrievalMetrics,
  createEvaluationFingerprint,
  evaluateRuntimeRetrievalCase,
  runRuntimeRetrievalCases,
} from '../../../eval/helpers/runtimeRetrievalEvaluator.js';

describe('runtime retrieval evaluation', () => {
  it('uses the production fusion ranker and enforces source policy before ranking', () => {
    const ranked = rankRetrievalCandidates({
      query: 'Kubernetes deployment',
      sourceTypes: ['cv', 'job_description'],
      topK: 3,
      minimumScore: 0,
      candidateChunks: [
        { chunkId: 'cv-relevant', sourceType: 'cv', text: 'Kubernetes deployment ownership', semantic: 0.9, metadata: {} },
        { chunkId: 'transcript-forbidden', sourceType: 'transcript', text: 'Kubernetes deployment', semantic: 0.99, metadata: {} },
        { chunkId: 'jd-context', sourceType: 'job_description', text: 'The role requires Kubernetes', semantic: 0.45, metadata: {} },
      ],
    });

    expect(ranked.map((item) => item.chunkId)).toEqual(['cv-relevant', 'jd-context']);
    expect(ranked[0].scores).toMatchObject({ semantic: 0.9, keyword: 1 });
    expect(RETRIEVAL_CONFIG.fusionWeights).toEqual({ semantic: 0.55, keyword: 0.35, metadata: 0.1 });
  });

  it('computes standard ranked retrieval metrics from actual ranked IDs', () => {
    expect(computeRetrievalMetrics({
      rankedChunkIds: ['relevant-a', 'forbidden-a', 'relevant-b'],
      relevantChunkIds: ['relevant-a', 'relevant-b'],
      forbiddenChunkIds: ['forbidden-a'],
      topK: 3,
      sourcePolicyPassed: false,
    })).toEqual({
      precisionAtK: 0.6667,
      recallAtK: 1,
      mrr: 1,
      ndcg: 0.9197,
      forbiddenEvidenceRetrievalRate: 0.3333,
      sourcePolicyAccuracy: 0,
    });
  });

  it('runs a synthetic corpus through the deterministic equivalent of the runtime scoring path', async () => {
    const evaluation = await evaluateRuntimeRetrievalCase({
      schemaVersion: 'retrieval_case_v1',
      caseId: 'node_api_ownership',
      datasetVersion: 'role-fit-retrieval-v1',
      query: 'Node.js API latency ownership',
      sourceTypes: ['cv'],
      topK: 2,
      corpus: [
        { chunkId: 'cv-node', sourceType: 'cv', text: 'Owned a Node.js API and reduced latency.', metadata: {} },
        { chunkId: 'cv-design', sourceType: 'cv', text: 'Created marketing design assets.', metadata: {} },
        { chunkId: 'jd-node', sourceType: 'job_description', text: 'The role needs Node.js API skills.', metadata: {} },
      ],
      relevantChunkIds: ['cv-node'],
      forbiddenChunkIds: ['jd-node'],
      labels: { domain: 'backend', risk: 'high' },
      expectedFallback: null,
    });

    const directRank = await rankInMemoryRetrievalCorpus({
      query: 'Node.js API latency ownership',
      sourceTypes: ['cv'],
      topK: 2,
      corpus: [
        { chunkId: 'cv-node', sourceType: 'cv', text: 'Owned a Node.js API and reduced latency.', metadata: {} },
        { chunkId: 'cv-design', sourceType: 'cv', text: 'Created marketing design assets.', metadata: {} },
        { chunkId: 'jd-node', sourceType: 'job_description', text: 'The role needs Node.js API skills.', metadata: {} },
      ],
    });

    expect(evaluation.rankedChunks).toEqual(directRank);
    expect(evaluation.rankedChunks[0].chunkId).toBe('cv-node');
    expect(evaluation.metrics.recallAtK).toBe(1);
    expect(evaluation.metrics.forbiddenEvidenceRetrievalRate).toBe(0);
    expect(evaluation.configFingerprint).toMatch(/^sha256:/);
  });

  it('fingerprints versioned datasets and retrieval configuration deterministically', () => {
    const input = {
      datasetVersion: 'role-fit-retrieval-v1',
      config: RETRIEVAL_CONFIG,
    };

    expect(createEvaluationFingerprint(input)).toBe(createEvaluationFingerprint(input));
    expect(createEvaluationFingerprint(input)).not.toBe(createEvaluationFingerprint({ ...input, datasetVersion: 'v2' }));
    expect(createEvaluationFingerprint(input)).not.toBe(createEvaluationFingerprint({
      ...input,
      config: { ...RETRIEVAL_CONFIG, fusionWeights: { semantic: 1, keyword: 0, metadata: 0 } },
    }));
  });

  it('persists aggregate and sliced metrics for a versioned retrieval dataset', async () => {
    const summary = await runRuntimeRetrievalCases({
      schemaVersion: 'retrieval_dataset_v1',
      datasetVersion: 'role-fit-retrieval-v1',
      cases: [{
        schemaVersion: 'retrieval_case_v1',
        caseId: 'api-evidence',
        datasetVersion: 'role-fit-retrieval-v1',
        query: 'Node.js API evidence',
        sourceTypes: ['cv'],
        topK: 1,
        corpus: [{ chunkId: 'cv-api', sourceType: 'cv', text: 'Built a Node.js API.', metadata: {} }],
        relevantChunkIds: ['cv-api'],
        forbiddenChunkIds: [],
        labels: { domain: 'backend', risk: 'high' },
        expectedFallback: null,
      }],
    });

    expect(summary).toMatchObject({
      schemaVersion: 'retrieval_eval_report_v1',
      datasetVersion: 'role-fit-retrieval-v1',
      casesRun: 1,
      metrics: { precisionAtK: 1, recallAtK: 1, mrr: 1, ndcg: 1 },
      slices: {
        'domain:backend': { casesRun: 1 },
        'risk:high': { casesRun: 1 },
      },
    });
  });
});
