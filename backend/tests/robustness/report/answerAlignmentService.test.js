import { describe, expect, it } from 'vitest';

import {
  buildAnswerAlignments,
  buildRoleFitReportSummary,
} from '../../../src/services/report/answerAlignmentService.js';
import { buildReportDraft } from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';
import { validateReportOutput } from '../../../src/services/schemaValidationService.js';

const proofStrategy = {
  schemaVersion: 'interview_proof_strategy_v1',
  artifactStatus: 'ready',
  mustCover: [{
    coverageId: 'cov-intent-delivery',
    roleIntentId: 'intent-delivery',
    type: 'role_intent',
    minQuestions: 1,
    status: 'pending',
  }],
};

const poolItem = {
  questionId: 'pool-delivery',
  schemaVersion: 'v3',
  text: 'Tell me about a time you improved production delivery reliability.',
  topic: 'Production delivery reliability',
  proofPointId: 'cov-intent-delivery',
  coverageContractIds: ['cov-intent-delivery'],
  testedRoleIntentIds: ['intent-delivery'],
  recommendedEvidenceIds: ['evidence-delivery'],
  evidenceAngle: 'production delivery ownership',
  expectedSignal: ['personal ownership', 'validation', 'measurable outcome'],
};

const roleEvidenceMap = {
  schemaVersion: 'role_evidence_map_v2',
  items: [{
    roleIntentId: 'intent-delivery',
    roleIntent: 'Own reliable production delivery',
    classification: 'direct',
    sourceEvidence: [{
      evidenceId: 'evidence-delivery',
      text: 'Owned a production release workflow and reduced failed releases by 35%.',
      sourceTrace: { section: 'experience', sourceType: 'experience', chunkId: 'cv-delivery' },
    }],
  }],
};

const acceptedPair = {
  questionId: 'question-delivery',
  questionTurn: {
    id: 'turn-question-delivery',
    role: 'ai',
    text: poolItem.text,
    metadata: {
      countsAsQuestion: true,
      preparedQuestionId: poolItem.questionId,
      rankTrace: {
        proofPointId: poolItem.proofPointId,
        testedRoleIntentIds: poolItem.testedRoleIntentIds,
        recommendedEvidenceIds: poolItem.recommendedEvidenceIds,
        evidenceAngle: poolItem.evidenceAngle,
      },
    },
  },
  answerTurn: {
    id: 'turn-answer-delivery',
    role: 'user',
    text: 'In my previous role I owned the production release workflow. I added validation checks and reduced failed releases by 35%.',
    metadata: { countsAsAnswer: true, transcriptStatus: 'accepted' },
  },
};

const buildInput = (questionAnswerPairs = [acceptedPair]) => ({
  questionAnswerPairs,
  interviewPlan: {
    roleFit: { proofStrategy },
    questionPool: [poolItem],
  },
  analysisResult: { roleEvidenceMap },
  session: { id: 'session-role-fit-report', userId: 'user-role-fit-report' },
});

describe('answer alignment service', () => {
  it('builds a grounded 0-100 alignment only from an accepted question-answer pair', () => {
    const alignments = buildAnswerAlignments(buildInput());

    expect(alignments).toHaveLength(1);
    expect(alignments[0]).toMatchObject({
      schemaVersion: 'answer_alignment_v2',
      compatibilityVersion: 'answer_alignment_v1',
      turnId: 'turn-answer-delivery',
      questionId: 'question-delivery',
      proofPointId: 'cov-intent-delivery',
      testedRoleIntentIds: ['intent-delivery'],
      groundingStatus: 'grounded',
    });
    expect(alignments[0].score).toBeGreaterThanOrEqual(80);
    expect(alignments[0].score).toBeLessThanOrEqual(100);
    expect(alignments[0].label).toBe('strong');
    expect(alignments[0].scoreBreakdown).toEqual(expect.objectContaining({
      questionAlignment: expect.any(Number),
      evidenceFit: expect.any(Number),
      evidenceClarity: expect.any(Number),
      roleIntentFit: expect.any(Number),
      naturalness: expect.any(Number),
      concision: expect.any(Number),
    }));
    expect(alignments[0].score).toBe(Object.values(alignments[0].scoreBreakdown)
      .reduce((sum, value) => sum + value, 0));
    expect(alignments[0].evidenceUseDiagnosis).toEqual(expect.objectContaining({
      status: 'matched_recommended_evidence',
      recommendedEvidenceIds: ['evidence-delivery'],
      detectedEvidenceIds: ['evidence-delivery'],
    }));
    expect(alignments[0].detectedEvidenceUsed).toEqual([expect.objectContaining({
      evidenceId: 'evidence-delivery',
      confidence: expect.stringMatching(/high|medium/),
      angleUsed: 'production delivery ownership',
    })]);
    expect(alignments[0].clarificationCoaching).toEqual(expect.objectContaining({ groundedBy: 'accepted_answer' }));
    expect(alignments[0].aiJudgementCoaching).toEqual(expect.objectContaining({ groundedBy: 'question_type' }));
  });

  it('diagnoses answers that miss the recommended evidence angle without inventing support', () => {
    const [alignment] = buildAnswerAlignments(buildInput([{
      ...acceptedPair,
      answerTurn: {
        ...acceptedPair.answerTurn,
        text: 'I enjoy learning new tools and prefer working with organized teams.',
      },
    }]));

    expect(alignment.schemaVersion).toBe('answer_alignment_v2');
    expect(alignment.detectedEvidenceUsed).toEqual([]);
    expect(alignment.evidenceUseDiagnosis).toEqual(expect.objectContaining({
      status: 'recommended_evidence_not_used',
      recommendedEvidenceIds: ['evidence-delivery'],
      detectedEvidenceIds: [],
    }));
    expect(alignment.label).not.toBe('strong');
    expect(alignment.groundingStatus).toBe('limited');
  });

  it('does not create alignment for repair, confirmation, or rejected transcript turns', () => {
    const excludedPairs = [
      {
        ...acceptedPair,
        answerTurn: { ...acceptedPair.answerTurn, metadata: { turnType: 'clarification', countsAsAnswer: false } },
      },
      {
        ...acceptedPair,
        answerTurn: { ...acceptedPair.answerTurn, metadata: { turnType: 'transcript_confirmation_response' } },
      },
      {
        ...acceptedPair,
        answerTurn: { ...acceptedPair.answerTurn, metadata: { transcriptStatus: 'rejected' } },
      },
    ];

    expect(buildAnswerAlignments(buildInput(excludedPairs))).toEqual([]);
  });

  it('returns an explicit unavailable state without breaking a legacy report', () => {
    const summary = buildRoleFitReportSummary({
      questionAnswerPairs: [acceptedPair],
      interviewPlan: { questionPool: [] },
      analysisResult: {},
      session: { id: 'legacy-session', userId: 'legacy-user' },
    });

    expect(summary).toEqual(expect.objectContaining({
      schemaVersion: 'role_fit_report_v1',
      status: 'legacy',
      answerAlignments: [],
      evidenceUsageMap: { totalUses: 0, items: [] },
    }));
  });

  it('reports must-cover outcomes and question reasons without exposing CV snippets', () => {
    const summary = buildRoleFitReportSummary(buildInput());

    expect(summary.status).toBe('ready');
    expect(summary.schemaVersion).toBe('role_fit_report_v2');
    expect(summary.roleIntentCoverage).toMatchObject({ total: 1, covered: 1, missing: 0 });
    expect(summary.evidenceUsageMap).toMatchObject({ totalUses: 1 });
    expect(summary.roleFitDiagnostics).toMatchObject({
      schemaVersion: 'role_fit_diagnostics_v1',
      proofStrategyStatus: 'ready',
      answerAlignmentStatus: 'ready',
      counts: expect.objectContaining({
        evidenceMapItemCount: 1,
        proofCoverageCount: 1,
        answerAlignmentCount: 1,
      }),
    });
    expect(summary.questionReasoning[0]).toMatchObject({
      questionId: 'question-delivery',
      topic: 'Production delivery reliability',
    });
    expect(JSON.stringify(summary.questionReasoning)).not.toContain('reduced failed releases by 35%');
    expect(summary.coachingProgress).toEqual(expect.objectContaining({
      schemaVersion: 'role_fit_coaching_progress_v1',
      clarification: expect.objectContaining({ practised: 1 }),
    }));
  });

  it('preserves the Role-Fit extension through report v7 schema validation', () => {
    const roleFit = buildRoleFitReportSummary(buildInput());
    const draft = buildReportDraft({
      session: { id: 'session-role-fit-report', totalQuestions: 1 },
      analysisResult: { overallScore: 70, explanation: { strengths: [], gaps: [] } },
      interviewPlan: {},
      evidenceSummary: { totals: {}, averageStrength: 0, strongestExamples: [] },
      interviewMetrics: { candidateTurnCount: 1, interviewerQuestionCount: 1, plannedQuestionCount: 1 },
      candidateFeedback: {},
      roleFit,
    });
    const validated = validateReportOutput(draft);

    expect(validated.schemaVersion).toBe('v7');
    expect(validated.roleFit).toEqual(roleFit);
  });
});
