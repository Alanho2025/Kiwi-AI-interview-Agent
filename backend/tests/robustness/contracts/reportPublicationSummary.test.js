import { describe, expect, it } from 'vitest';

import {
  buildCandidateReportProjection,
  buildCandidateReportPublicationSummary,
  buildLegacyReportLimitation,
  redactSensitiveReportValues,
  sanitizeCandidateReportProjection,
} from '../../../src/services/report/reportPublicationSummaryService.js';
import { validateReportOutput } from '../../../src/services/schemaValidationService.js';

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
          turnBreakdowns: [
            {
              question: 'Question?',
              answer: 'Answer.',
              feedback: 'Feedback.',
              rubricType: 'role_specific',
              frameworkKey: 'safety_quality_ethics',
              frameworkLabel: 'Safety, Quality and Ethics',
              starApplicable: false,
              structureLabel: 'Role-specific reasoning',
              frameworkBreakdown: {
                normalizedScore: 6,
                level: 4,
                scorePercent: 60,
                privateEvaluatorNote: 'must not be published',
                dimensions: [{
                  key: 'validationVerification',
                  label: 'Validation / Verification',
                  status: 'partial',
                  score: 6,
                  level: 4,
                  scorePercent: 60,
                  reason: 'The validation method needs more detail.',
                  rawScoringDiagnostics: { hidden: true },
                }],
              },
            },
            { question: ' QUESTION?  ', answer: 'Second answer.', feedback: 'Second feedback.' },
            { question: 'Unmatched question?', answer: 'Third answer.', feedback: 'Third feedback.' },
            { question: 'Unsafe reason?', answer: 'Fourth answer.', feedback: 'Fourth feedback.' },
          ],
          answerRewriteExamples: [
            {
              question: 'Question?',
              weak: 'Second answer.',
              better: 'Second better.',
              status: 'ready',
              evidenceUsed: ['private-evidence'],
            },
            {
              question: 'Question?',
              weak: 'Answer.',
              better: 'Better.',
              status: 'ready',
            },
            { question: 'Unmatched question?', weak: 'Third answer.', better: 'private ambiguous rewrite one', status: 'ready' },
            { question: 'Unmatched question?', weak: 'Third answer.', better: 'private ambiguous rewrite two', status: 'ready' },
            { question: 'Unsafe reason?', weak: 'Fourth answer.', status: 'unavailable', failureReason: 'private stack diagnostic' },
          ],
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
          candidateTurnAssessments: [
            {
              question: 'Question?',
              status: 'partly_addressed',
              score: 61,
              summary: 'Relevant, but add validation.',
              missingSignals: ['validation'],
              nextStep: 'Explain how you verified the outcome.',
              source: 'generic_question_alignment',
              proofPointId: 'private-proof',
            },
            {
              question: 'Question?',
              status: 'needs_clearer_connection',
              score: 35,
              summary: 'Needs a clearer connection.',
              missingSignals: ['specific_context'],
              nextStep: 'State the context first.',
              source: 'role_fit_alignment',
            },
            {
              question: 'Unmatched question?',
              status: 'needs_clearer_connection',
              score: 30,
              summary: 'Needs a clearer connection.',
              missingSignals: ['specific_context'],
              nextStep: 'State the context first.',
              source: 'role_fit_alignment',
            },
          ],
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
      overall: 69,
    });
    expect(JSON.stringify(projection)).not.toMatch(/cv[-–]?jd|cvJdMatch/i);
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
    expect(projection.report.candidateFeedback.turnBreakdowns[0]).toMatchObject({
      answerAssessment: {
        status: 'partly_addressed',
        score: 61,
        missingSignals: ['validation'],
      },
      strongerAnswer: { status: 'ready', answer: 'Better.' },
      rubricType: 'role_specific',
      frameworkKey: 'safety_quality_ethics',
      frameworkLabel: 'Safety, Quality and Ethics',
      starApplicable: false,
      structureLabel: 'Role-specific reasoning',
      frameworkBreakdown: {
        level: 4,
        scorePercent: 60,
        dimensions: [{
          key: 'validationVerification',
          label: 'Validation / Verification',
          status: 'partial',
          level: 4,
          scorePercent: 60,
          reason: 'The validation method needs more detail.',
        }],
      },
    });
    expect(projection.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown)
      .not.toHaveProperty('normalizedScore');
    expect(projection.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown.dimensions[0])
      .not.toMatchObject({ score: expect.anything(), weight: expect.anything(), earnedPoints: expect.anything() });
    expect(projection.report.candidateFeedback.turnBreakdowns[0].answerAssessment).not.toHaveProperty('source');
    expect(projection.report.candidateFeedback.turnBreakdowns[0].answerAssessment).not.toHaveProperty('proofPointId');
    expect(projection.report.candidateFeedback.turnBreakdowns[1]).toMatchObject({
      answerAssessment: { score: 35 },
      strongerAnswer: { status: 'ready', answer: 'Second better.' },
    });
    expect(projection.report.candidateFeedback.turnBreakdowns[2].strongerAnswer).toMatchObject({
      status: 'unavailable',
      unavailableReason: expect.stringMatching(/could not be matched/i),
    });
    expect(projection.report.candidateFeedback.turnBreakdowns[3].strongerAnswer).toMatchObject({
      status: 'unavailable',
      unavailableReason: expect.stringMatching(/could not be generated reliably/i),
    });
    expect(projection.report.candidateFeedback).not.toHaveProperty('answerRewriteExamples');
    expect(JSON.stringify(projection)).not.toMatch(/generic_question_alignment|private-proof|private-evidence/);
    expect(JSON.stringify(projection)).not.toMatch(/candidate@example\\.com|\\+64 21 555 123|9999|internal_flag|private ambiguous rewrite|private stack diagnostic/);
    expect(JSON.stringify(projection)).not.toContain('privateEvaluatorNote');
    expect(JSON.stringify(projection)).not.toContain('rawScoringDiagnostics');
  });

  it('maps framework scores to bounded candidate percentages deterministically', () => {
    const projection = buildCandidateReportProjection({
      report: {
        candidateFeedback: {
          turnBreakdowns: [{
            question: 'Mapped question?',
            frameworkBreakdown: {
              normalizedScore: 7,
              scorePercent: null,
              level: null,
              dimensions: [
                { key: 'weighted', score: 7.5, weight: 10, level: 4 },
                { key: 'zero-percent', scorePercent: 0, score: 10, weight: 10, level: 3 },
                { key: 'null-level', score: 5, level: null },
                { key: 'empty-level', score: 5, level: '' },
                { key: 'boolean-level', score: 5, level: false },
                { key: 'bounded-high', scorePercent: 125, level: 9 },
                { key: 'bounded-low', scorePercent: -10, level: 0 },
              ],
            },
          }],
        },
      },
    });

    expect(projection.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown).toMatchObject({
      scorePercent: 70,
      dimensions: [
        { key: 'weighted', scorePercent: 75, level: 4 },
        { key: 'zero-percent', scorePercent: 0, level: 3 },
        { key: 'null-level', scorePercent: 50 },
        { key: 'empty-level', scorePercent: 50 },
        { key: 'boolean-level', scorePercent: 50 },
        { key: 'bounded-high', scorePercent: 100, level: 5 },
        { key: 'bounded-low', scorePercent: 0, level: 1 },
      ],
    });
    expect(projection.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown).not.toHaveProperty('level');
    expect(projection.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown.dimensions[2]).not.toHaveProperty('level');
    expect(projection.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown.dimensions[3]).not.toHaveProperty('level');
    expect(projection.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown.dimensions[4]).not.toHaveProperty('level');
  });

  it('preserves candidate-safe framework fields through schema round-trip', () => {
    const validatedReport = validateReportOutput({
      candidateFeedback: {
        turnBreakdowns: [
          {
            question: 'Missing score?',
            frameworkBreakdown: {
              normalizedScore: null,
              scoreReason: 'Score source was unavailable.',
              dimensions: [{
                key: 'missing',
                score: null,
                weight: 20,
                earnedPoints: null,
                reason: 'No score source.',
              }],
            },
          },
          {
            question: 'Zero score?',
            frameworkBreakdown: {
              normalizedScore: 0,
              scoreReason: 'No evidence was present.',
              dimensions: [{
                key: 'zero',
                score: 0,
                weight: 20,
                level: 1,
                reason: 'No evidence was present.',
              }],
            },
          },
          {
            question: 'Weighted score?',
            frameworkBreakdown: {
              normalizedScore: 5,
              level: 3,
              scoreReason: 'The weighted framework score is partial.',
              dimensions: [{
                key: 'weighted',
                score: 10,
                weight: 20,
                earnedPoints: 4,
                level: 3,
                reason: 'The dimension is partially supported.',
              }],
            },
          },
        ],
      },
    });
    const projection = buildCandidateReportProjection({ report: validatedReport });
    const turns = projection.report.candidateFeedback.turnBreakdowns;

    expect(turns[0].frameworkBreakdown).toMatchObject({
      scoreReason: 'Score source was unavailable.',
      dimensions: [{ key: 'missing', reason: 'No score source.' }],
    });
    expect(turns[0].frameworkBreakdown).not.toHaveProperty('normalizedScore');
    expect(turns[0].frameworkBreakdown.dimensions[0]).not.toMatchObject({
      score: expect.anything(),
      weight: expect.anything(),
      earnedPoints: expect.anything(),
    });
    expect(turns[0].frameworkBreakdown).not.toHaveProperty('scorePercent');
    expect(turns[0].frameworkBreakdown.dimensions[0]).not.toHaveProperty('scorePercent');

    expect(turns[1].frameworkBreakdown).toMatchObject({
      scorePercent: 0,
      dimensions: [{ key: 'zero', scorePercent: 0, level: 1 }],
    });

    expect(turns[2].frameworkBreakdown).toMatchObject({
      scorePercent: 50,
      level: 3,
      scoreReason: 'The weighted framework score is partial.',
      dimensions: [{
        key: 'weighted',
        scorePercent: 50,
        level: 3,
        reason: 'The dimension is partially supported.',
      }],
    });
    expect(turns[2].frameworkBreakdown).not.toHaveProperty('normalizedScore');
    expect(turns[2].frameworkBreakdown.dimensions[0]).not.toMatchObject({
      score: expect.anything(),
      weight: expect.anything(),
      earnedPoints: expect.anything(),
    });
  });

  it('omits any legacy score fallback when no interview-performance score was persisted', () => {
    const projection = buildCandidateReportProjection({
      report: { scores: { overall: 72, cvJdMatch: 75, interview: 68, micro: 67, macro: 76, requirements: 74 } },
    });

    expect(projection.report.scores).toEqual({});
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
