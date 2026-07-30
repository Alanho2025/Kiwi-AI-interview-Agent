import { describe, expect, it } from 'vitest';

import {
  buildCandidateReportProjection,
  buildCandidateReportPublicationSummary,
  buildLegacyReportLimitation,
  redactSensitiveReportValues,
  sanitizeCandidateReportProjection,
} from '../../../src/services/report/reportPublicationSummaryService.js';

describe('candidate-safe report publication summary', () => {
  it.each([
    ['ready', 'verified', 'Report checks complete', null],
    ['ready_after_repair', 'verified_after_repair', 'Report checks complete after repair', null],
    ['needs_review', 'needs_review', 'This report still needs review', 'recheck_report'],
    ['repair_failed', 'verification_incomplete', 'Report verification is incomplete', 'recheck_report'],
  ])('maps %s to a candidate-safe outcome', (latestStatus, status, title, nextActionType) => {
    const summary = buildCandidateReportPublicationSummary({
      latestStatus,
      qaResult: {
        qualityFlags: ['private_internal_flag'],
        internalReasoning: 'private chain-of-thought',
      },
    });

    expect(summary).toMatchObject({
      schemaVersion: 'report_publication_summary_v1',
      status,
      title,
    });
    expect(summary.nextAction?.type || null).toBe(nextActionType);
    expect(JSON.stringify(summary)).not.toContain('private_internal_flag');
    expect(JSON.stringify(summary)).not.toContain('private chain-of-thought');
  });

  it('fails safe when a persisted status is missing or unknown', () => {
    expect(buildCandidateReportPublicationSummary({ latestStatus: 'unexpected_internal_state' }))
      .toMatchObject({
        status: 'status_unavailable',
        tone: 'info',
        nextAction: { type: 'recheck_report', label: 'Recheck report' },
      });
  });

  it('removes CP4 selection and grounding internals from candidate report projection', () => {
    const projection = sanitizeCandidateReportProjection({
      roleFit: {
        catalogQuestionId: 'catalog-ai-1',
        catalogVersion: '2026.2',
        knownEvidenceIds: ['cv_evidence_1'],
        knownRoleIntentIds: ['role_intent_1'],
        requiredCoverageIds: ['coverage_1'],
        evidenceReferences: [{ claimId: 'claim_1', sourceId: 'source_1', chunkId: 'chunk_1' }],
        roleIntentCoverage: { items: [{ coverageId: 'coverage_1', roleIntentId: 'role_intent_1' }] },
        answerAlignments: [{
          proofPointId: 'private-proof',
          testedRoleIntentIds: ['intent-private'],
          evidenceUseDiagnosis: {
            recommendedEvidenceIds: ['cv_evidence_1'],
            detectedEvidenceIds: ['cv_evidence_2'],
          },
          clarificationCoaching: { groundedBy: 'accepted_answer', coachingFeedback: 'Safe feedback.' },
        }],
      },
    });

    expect(projection).toEqual({
      roleFit: {
        evidenceReferences: [{}],
        roleIntentCoverage: { items: [{}] },
        answerAlignments: [{
          evidenceUseDiagnosis: {},
          clarificationCoaching: { coachingFeedback: 'Safe feedback.' },
        }],
      },
    });
  });

  it('projects only candidate report fields, caps priorities, and removes operational data', () => {
    const projection = buildCandidateReportProjection({
      sessionId: 'session-1',
      latestStatus: 'ready',
      executionCost: { totalCost: 1.23 },
      commercialStressTest: { totalLlmTokens: 9999 },
      candidateReflections: [{ text: 'private reflection' }],
      report: {
        schemaVersion: 'v7',
        generatedAt: '2026-07-30T00:00:00.000Z',
        candidateName: 'Candidate',
        jobTitle: 'Product Manager',
        summary: 'Concise summary.',
        scores: {
          overall: 72,
          cvJdMatch: 75,
          interviewPerformance: 69,
          directEvidenceTurns: 4,
        },
        candidateFeedback: {
          overallTakeaway: 'Lead with clearer evidence.',
          improvementPriorities: [
            { title: 'One' },
            { title: 'Two' },
            { title: 'Three' },
            { title: 'Four' },
          ],
          turnBreakdowns: [{ question: 'Question?', answer: 'Answer.', feedback: 'Feedback.' }],
          answerRewriteExamples: [{ weak: 'Weak.', better: 'Better.' }],
          coachingAdvice: [{ title: 'Duplicate coaching' }],
          quoteAnalyses: [{ quote: 'Raw quote' }],
        },
        transcriptRisks: [{ message: 'Material transcript limitation.' }],
        evidenceReferences: [{ evidenceSnippet: 'email candidate@example.com or +64 21 555 123' }],
        evidenceDiagnostics: { averageStrength: 2.5 },
        interviewMetrics: { candidateTurnCount: 4 },
        commercialStressTest: { totalLlmTokens: 9999 },
        roleFit: {
          status: 'ready',
          roleIntentCoverage: { total: 1, covered: 1 },
          answerAlignments: [{ question: 'Private role-fit detail' }],
        },
      },
      qaResult: {
        coverageScore: 91,
        rawScoringDiagnostics: { hidden: true },
        qualityFlags: ['internal_flag'],
      },
    });

    expect(projection.report.candidateFeedback.improvementPriorities).toHaveLength(3);
    expect(projection.report.scores).toEqual({
      overall: 72,
      cvJdMatch: 75,
      interviewPerformance: 69,
    });
    expect(projection).not.toHaveProperty('executionCost');
    expect(projection).not.toHaveProperty('commercialStressTest');
    expect(projection).not.toHaveProperty('candidateReflections');
    expect(projection).not.toHaveProperty('qaResult');
    expect(projection.report).not.toHaveProperty('evidenceReferences');
    expect(projection.report).not.toHaveProperty('evidenceDiagnostics');
    expect(projection.report).not.toHaveProperty('interviewMetrics');
    expect(projection.report).not.toHaveProperty('roleFit');
    expect(projection.report).not.toHaveProperty('schemaVersion');
    expect(projection.report.candidateFeedback).not.toHaveProperty('coachingAdvice');
    expect(projection.report.candidateFeedback).not.toHaveProperty('quoteAnalyses');
    expect(JSON.stringify(projection)).not.toMatch(/candidate@example\\.com|\\+64 21 555 123|9999|internal_flag/);
  });

  it('redacts nested email, phone, and street-address values without hiding ordinary scores', () => {
    expect(redactSensitiveReportValues({
      contact: 'Email candidate@example.com, call +64 21 555 123, or visit 12 Example Road.',
      score: 72.5,
    })).toEqual({
      contact: 'Email [email redacted], call [phone redacted], or visit [address redacted].',
      score: 72.5,
    });
  });

  it('flags a legacy user_answer that looks like a clarification without rewriting it', () => {
    const transcript = [{
      role: 'user',
      text: 'Can you clarify what you are asking? I cannot follow.',
      metadata: { turnType: 'user_answer', countsAsAnswer: true },
    }];

    expect(buildLegacyReportLimitation({ transcript })).toMatchObject({
      code: 'legacy_clarification_may_have_been_scored',
      action: 'regenerate_report',
    });
    expect(transcript[0].text).toContain('Can you clarify');
  });
});
