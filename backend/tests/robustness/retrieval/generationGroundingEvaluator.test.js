import { describe, expect, it } from 'vitest';

import {
  evaluateGenerationGroundingCase,
  runGenerationGroundingCases,
} from '../../../eval/helpers/generationGroundingEvaluator.js';

const baseCase = {
  schemaVersion: 'generation_grounding_case_v1',
  caseId: 'node_api_grounding',
  datasetVersion: 'role-fit-generation-v1',
  input: {
    objective: 'Summarize candidate evidence relevant to backend API ownership.',
    query: 'Node.js API ownership and measurable result',
  },
  retrieval: {
    chunkIds: ['cv-node', 'jd-kubernetes'],
    contexts: [
      'Built a Node.js API and reduced response time by 30 percent.',
      'The role requires Kubernetes production experience.',
    ],
    contextSources: {
      'cv-node': 'cv',
      'jd-kubernetes': 'job_description',
    },
    configFingerprint: 'sha256:test',
  },
  reference: {
    requiredClaims: ['Built a Node.js API', 'reduced response time by 30 percent'],
    forbiddenClaims: ['deployed Kubernetes in production'],
    allowedClaimSourceTypes: ['cv'],
  },
  labels: { domain: 'backend', risk: 'high' },
};

describe('generation grounding evaluation', () => {
  it('scores grounded claims separately from retrieval ranking', () => {
    const result = evaluateGenerationGroundingCase({
      ...baseCase,
      output: {
        text: 'Built a Node.js API and reduced response time by 30 percent.',
        claimRefs: ['cv-node'],
        claims: [
          { text: 'Built a Node.js API', evidenceChunkIds: ['cv-node'] },
          { text: 'reduced response time by 30 percent', evidenceChunkIds: ['cv-node'] },
        ],
      },
    });

    expect(result.metrics).toEqual({
      claimFaithfulness: 1,
      requiredClaimCoverage: 1,
      responseRelevancy: 1,
      noiseSensitivity: 0,
      unsupportedClaimFailureRate: 0,
    });
    expect(result.unsupportedClaims).toEqual([]);
  });

  it('does not treat a JD requirement as proof that the candidate has that experience', () => {
    const result = evaluateGenerationGroundingCase({
      ...baseCase,
      output: {
        text: 'Built a Node.js API. Deployed Kubernetes in production.',
        claimRefs: ['cv-node', 'jd-kubernetes'],
        claims: [
          { text: 'Built a Node.js API', evidenceChunkIds: ['cv-node'] },
          { text: 'deployed Kubernetes in production', evidenceChunkIds: ['jd-kubernetes'] },
        ],
      },
    });

    expect(result.metrics.claimFaithfulness).toBe(0.5);
    expect(result.metrics.noiseSensitivity).toBe(0.5);
    expect(result.metrics.unsupportedClaimFailureRate).toBe(0.5);
    expect(result.unsupportedClaims).toEqual(['deployed Kubernetes in production']);
    expect(result.forbiddenClaimsFound).toEqual(['deployed Kubernetes in production']);
  });

  it('persists aggregate and sliced metrics for a versioned generation dataset', () => {
    const summary = runGenerationGroundingCases({
      schemaVersion: 'generation_grounding_dataset_v1',
      datasetVersion: 'role-fit-generation-v1',
      cases: [{
        ...baseCase,
        output: {
          text: 'Built a Node.js API and reduced response time by 30 percent.',
          claimRefs: ['cv-node'],
          claims: [
            { text: 'Built a Node.js API', evidenceChunkIds: ['cv-node'] },
            { text: 'reduced response time by 30 percent', evidenceChunkIds: ['cv-node'] },
          ],
        },
      }],
    });

    expect(summary).toMatchObject({
      schemaVersion: 'generation_grounding_eval_report_v1',
      datasetVersion: 'role-fit-generation-v1',
      casesRun: 1,
      metrics: { claimFaithfulness: 1, requiredClaimCoverage: 1 },
      slices: {
        'domain:backend': { casesRun: 1 },
        'risk:high': { casesRun: 1 },
      },
    });
  });
});
