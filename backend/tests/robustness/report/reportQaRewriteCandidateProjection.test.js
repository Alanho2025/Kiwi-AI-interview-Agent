import { describe, expect, it } from 'vitest';

import { buildCandidateQaRewriteResponse } from '../../../src/controllers/reportQaRewriteController.js';

describe('report QA rewrite candidate projection', () => {
  it('removes report, QA, stored-record, and rewrite internals from the candidate response', () => {
    const result = buildCandidateQaRewriteResponse({
      sessionId: 'session-owner',
      report: { roleFit: { catalogQuestionId: 'catalog-private', answerAlignments: [{ proofPointId: 'proof-private' }] } },
      qaResult: { rawScoringDiagnostics: { internal: true }, coaching: { groundedBy: 'accepted_answer' } },
      originalQaResult: { rankTrace: ['private'] },
      stored: {
        latestStatus: 'ready',
        reportVersions: [{ report: { catalogVersion: '2026.2' } }],
        repairHistory: [{ internal: true }],
        rewriteMetadata: { error: 'private stack detail' },
        report: { roleFit: { catalogVersion: '2026.2', answerAlignments: [{ evidenceId: 'private-evidence' }] } },
        qaResult: { rawScoringDiagnostics: { internal: true } },
      },
      rewriteApplied: true,
      executionCost: { totalCost: 4.2 },
      commercialStressTest: { totalLlmTokens: 12000 },
    });

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/catalog-private|proof-private|private-evidence|rawScoringDiagnostics|rankTrace|rewriteMetadata|private stack detail/);
    expect(result.rewriteApplied).toBe(true);
    expect(result.sessionId).toBe('session-owner');
    expect(result.publicationSummary.status).toBe('verified');
    expect(result.report).not.toHaveProperty('roleFit');
    expect(result).not.toHaveProperty('executionCost');
    expect(result).not.toHaveProperty('commercialStressTest');
  });
});
