import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildCandidateQaRewriteResponse } from '../../../src/controllers/reportQaRewriteController.js';
import { generateCandidateFeedback } from '../../../src/services/reportCoachingService.js';
import * as deepseekModule from '../../../src/services/deepseekService.js';

afterEach(() => {
  vi.restoreAllMocks();
});

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

  it('uses the shared candidate projection for framework fields in a QA rewrite response', () => {
    const result = buildCandidateQaRewriteResponse({
      sessionId: 'session-owner',
      stored: {
        latestStatus: 'ready',
        report: {
          candidateFeedback: {
            turnBreakdowns: [{
              question: 'How would you validate the result?',
              answer: 'I would compare the outcome with the acceptance criteria.',
              feedback: 'Name the measurement method.',
              rubricType: 'role_specific',
              frameworkKey: 'role_specific_reasoning',
              frameworkLabel: 'Role-specific reasoning',
              starApplicable: false,
              frameworkBreakdown: {
                normalizedScore: 6,
                dimensions: [{ key: 'validationVerification', label: 'Validation', status: 'partial', score: 6, reason: 'Add the metric.' }],
              },
            }],
          },
          roleFit: { candidateTurnAssessments: [] },
        },
      },
      rewriteApplied: true,
    });

    expect(result.report.candidateFeedback.turnBreakdowns[0]).toMatchObject({
      rubricType: 'role_specific',
      frameworkKey: 'role_specific_reasoning',
      frameworkLabel: 'Role-specific reasoning',
      starApplicable: false,
      frameworkBreakdown: {
        scorePercent: 60,
        dimensions: [{ key: 'validationVerification', status: 'partial', scorePercent: 60 }],
      },
    });

    expect(result.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown).not.toHaveProperty('normalizedScore');
    expect(result.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown.dimensions[0]).not.toHaveProperty('score');
    expect(result.stored.report.candidateFeedback.turnBreakdowns).toEqual(
      result.report.candidateFeedback.turnBreakdowns,
    );
  });

  it('matches reordered duplicate-question rewrites only by the exact question and weak answer pair', async () => {
    vi.spyOn(deepseekModule, 'callDeepSeek').mockResolvedValueOnce({
      content: JSON.stringify({
        answerRewriteExamples: [
          { question: 'Same question?', weak: 'Second answer.', better: 'Second answer with a grounded result.' },
          { question: 'Same question?', weak: 'First answer.', better: 'First answer with a grounded result.' },
        ],
      }),
    });

    const result = await generateCandidateFeedback({
      deterministicFeedback: {
        answerRewriteExamples: [
          { question: 'Same question?', weak: 'First answer.', status: 'unavailable' },
          { question: 'Same question?', weak: 'Second answer.', status: 'unavailable' },
        ],
      },
    });

    expect(result.answerRewriteExamples.map((item) => item.better)).toEqual([
      'First answer with a grounded result.',
      'Second answer with a grounded result.',
    ]);
  });

  it('does not use question-only, answer-only, or array-index fallback for a rewrite', async () => {
    vi.spyOn(deepseekModule, 'callDeepSeek').mockResolvedValueOnce({
      content: JSON.stringify({
        answerRewriteExamples: [{
          question: 'Expected question?',
          weak: 'Different answer.',
          better: 'This must not be attached by question or index.',
        }],
      }),
    });

    const result = await generateCandidateFeedback({
      deterministicFeedback: {
        answerRewriteExamples: [{
          question: 'Expected question?',
          weak: 'Expected answer.',
          status: 'unavailable',
        }],
      },
    });

    expect(result.answerRewriteExamples).toEqual([expect.objectContaining({
      question: 'Expected question?',
      weak: 'Expected answer.',
      better: '',
      status: 'unavailable',
    })]);
  });
});
