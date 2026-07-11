import { describe, expect, it } from 'vitest';

import { runReportQaAgent } from '../../../src/services/agents/reportQaAgent.js';

const buildReport = (turn) => ({
  sessionId: 'session-qa-framework',
  summary: 'Decision: manual_review.',
  sections: [{ id: 'interaction_feedback', title: 'Interaction feedback', content: 'Stable.' }],
  evidenceReferences: ['interview answer'],
  interviewMetrics: { interviewerQuestionCount: 1, plannedQuestionCount: 1, candidateTurnCount: 1 },
  evidenceDiagnostics: { averageStrength: 2, totals: {} },
  scores: { averageInteractionScore: 0 },
  authenticityMetrics: {},
  candidateFeedback: {
    overallTakeaway: 'Useful evidence.',
    plainEnglishMetrics: [{ label: 'Evidence', interpretation: 'Partial.' }],
    coachingAdvice: [{
      theme: 'Improve evidence',
      advice: 'Add detail.',
      example: 'Explain the check.',
      evidenceLabel: 'supported_by_answer',
      confidenceLevel: 'medium',
      feedbackStatus: 'confirmed_feedback',
    }],
    answerRewriteExamples: [{ weak: 'Broad.', better: 'Specific.' }],
    turnBreakdowns: [{
      question: 'Question',
      answer: 'Answer',
      feedback: 'Feedback',
      evidenceLabel: 'supported_by_answer',
      confidenceLevel: 'medium',
      feedbackStatus: 'confirmed_feedback',
      ...turn,
    }],
  },
});

describe('report framework QA', () => {
  it('blocks every deterministic Role-Fit integrity failure', async () => {
    const report = buildReport({
      rubricType: 'starr',
      frameworkKey: 'behavioural_starr',
      starApplicable: true,
      starBreakdown: {
        situation: 'clear', task: 'clear', action: 'clear', resultOrReaction: 'clear', reflection: 'clear',
      },
    });
    report.roleFit = {
      status: 'limited',
      ownership: { verified: false },
      knownRoleIntentIds: ['intent-known'],
      knownEvidenceIds: ['evidence-known'],
      requiredCoverageIds: ['cov-required'],
      companyClaims: [{ claim: 'The company is entering healthcare.', reviewed: false }],
      roleIntentCoverage: { items: [] },
      answerAlignments: [{
        turnId: 'answer-1',
        questionId: 'question-1',
        proofPointId: '',
        testedRoleIntentIds: ['intent-missing'],
        detectedEvidenceUsed: [{ evidenceId: 'evidence-missing' }],
        score: 90,
        label: 'strong',
        groundingStatus: 'blocked',
      }],
    };

    const qa = await runReportQaAgent({
      report,
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toEqual(expect.arrayContaining([
      'role_intent_reference_missing',
      'answer_alignment_without_proof_point',
      'alignment_claim_not_grounded',
      'company_claim_not_in_reviewed_profile',
      'evidence_id_not_found',
      'must_cover_intent_unreported',
      'role_fit_artifact_not_owned',
    ]));
    expect(qa.passed).toBe(false);
  });

  it('blocks invalid Answer Alignment v2 dimensions and wrong-example diagnoses', async () => {
    const report = buildReport({
      rubricType: 'starr',
      frameworkKey: 'behavioural_starr',
      starApplicable: true,
      starBreakdown: {
        situation: 'clear', task: 'clear', action: 'clear', resultOrReaction: 'clear', reflection: 'clear',
      },
    });
    report.roleFit = {
      status: 'limited',
      ownership: { verified: true },
      knownRoleIntentIds: ['intent-known'],
      knownEvidenceIds: ['evidence-known'],
      requiredCoverageIds: ['cov-required'],
      roleIntentCoverage: { items: [{ coverageId: 'cov-required' }] },
      answerAlignments: [{
        schemaVersion: 'answer_alignment_v2',
        turnId: 'answer-1',
        questionId: 'question-1',
        proofPointId: 'cov-required',
        testedRoleIntentIds: ['intent-known'],
        detectedEvidenceUsed: [{ evidenceId: 'evidence-known' }],
        score: 105,
        label: 'partial',
        groundingStatus: 'grounded',
        scoreBreakdown: {
          questionAlignment: 20,
          evidenceFit: 20,
        },
        evidenceUseDiagnosis: { status: 'wrong_example' },
      }],
    };

    const qa = await runReportQaAgent({
      report,
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toEqual(expect.arrayContaining([
      'answer_alignment_score_out_of_range',
      'answer_alignment_missing_v2_dimensions',
      'answer_alignment_wrong_evidence_use',
    ]));
    expect(qa.passed).toBe(false);
  });

  it('flags deterministic report integrity mismatches', async () => {
    const report = buildReport({
      question: 'How did you validate that the feedback helped?',
      answer: 'In a support workflow I changed the test and reduced latency from 12 seconds to 3 seconds.',
      rubricType: 'company_motivation',
      frameworkKey: 'company_motivation',
      starApplicable: false,
      frameworkBreakdown: { dimensions: [{ key: 'companyReason', status: 'missing', score: 0 }] },
    });
    report.scores.overall = 58.6;
    report.interviewMetrics = {
      ...report.interviewMetrics,
      scoredCandidateAnswerCount: 2,
    };
    report.evidenceDiagnostics.totals = {
      direct_past_experience: 0,
      indirect_adjacent_experience: 0,
      hypothetical_understanding: 0,
      generic_filler: 1,
    };
    report.candidateFeedback.plainEnglishMetrics = [{
      id: 'overall_fit', label: 'Overall', value: 64.3, displayValue: '64.30/100', interpretation: 'Mismatch.',
    }];

    const qa = await runReportQaAgent({
      report,
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toEqual(expect.arrayContaining([
      'rubric_question_mismatch',
      'evidence_total_mismatch',
      'score_metric_mismatch',
      'turn_export_count_mismatch',
      'real_example_count_mismatch',
    ]));
    expect(qa.passed).toBe(false);
  });

  it('requires conflicting transcript claims to have a visible warning', async () => {
    const report = buildReport({
      rubricType: 'starr',
      frameworkKey: 'behavioural_starr',
      starApplicable: true,
      starBreakdown: {
        situation: 'clear', task: 'clear', action: 'clear', resultOrReaction: 'clear', reflection: 'clear',
      },
    });
    report.transcriptRisks = [{ code: 'conflicting_metric_values', message: '15% conflicts with 50%' }];

    const qa = await runReportQaAgent({
      report,
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toContain('unacknowledged_transcript_conflict');
  });

  it('rejects unreadable candidate-facing answer rewrites', async () => {
    const report = buildReport({
      rubricType: 'starr',
      frameworkKey: 'behavioural_starr',
      starApplicable: true,
      starBreakdown: {
        situation: 'clear', task: 'clear', action: 'clear', resultOrReaction: 'clear', reflection: 'clear',
      },
    });
    report.candidateFeedback.answerRewriteExamples = [{
      status: 'ready',
      question: 'Question',
      weak: 'Broad.',
      better: 'Topic: project. Action: [ŠªfPNºˆLRÕ]',
    }];

    const qa = await runReportQaAgent({
      report,
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toEqual(expect.arrayContaining([
      'invalid_answer_rewrite',
      'placeholder_answer_rewrite',
      'unreadable_answer_rewrite',
    ]));
  });

  it('does not treat duplicate generic labels as meaningful evidence coverage', async () => {
    const report = buildReport({
      rubricType: 'starr',
      frameworkKey: 'behavioural_starr',
      starApplicable: true,
      starBreakdown: {
        situation: 'clear', task: 'clear', action: 'clear', resultOrReaction: 'clear', reflection: 'clear',
      },
    });
    report.evidenceReferences = Array.from({ length: 8 }, () => ({ sourceType: 'jd', label: 'Job requirement' }));

    const qa = await runReportQaAgent({
      report,
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toContain('uninformative_evidence_references');
    expect(qa.consistencyChecks.find((item) => item.rule === 'meaningful_evidence_presence')?.passed).toBe(false);
  });
  it('flags missing role-specific framework breakdowns', async () => {
    const qa = await runReportQaAgent({
      report: buildReport({
        rubricType: 'role_specific',
        frameworkKey: 'role_specific_reasoning',
        starApplicable: false,
      }),
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toContain('missing_framework_breakdown');
  });

  it('flags STAR applied to a role-specific answer', async () => {
    const qa = await runReportQaAgent({
      report: buildReport({
        rubricType: 'role_specific',
        frameworkKey: 'role_specific_reasoning',
        starApplicable: true,
        starBreakdown: { result: 'partial' },
        frameworkBreakdown: { dimensions: [{ key: 'approach', score: 5 }] },
      }),
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toContain('role_specific_star_misapplied');
  });

  it('still requires STARR for behavioural answers', async () => {
    const qa = await runReportQaAgent({
      report: buildReport({
        rubricType: 'starr',
        frameworkKey: 'behavioural_starr',
        starApplicable: true,
        starBreakdown: null,
      }),
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toContain('missing_star_breakdown');
  });

  it('requires reflection in a v5 behavioural STARR breakdown', async () => {
    const qa = await runReportQaAgent({
      report: buildReport({
        rubricType: 'starr',
        frameworkKey: 'behavioural_starr',
        starApplicable: true,
        starBreakdown: {
          situation: 'clear', task: 'clear', action: 'clear', resultOrReaction: 'clear',
        },
      }),
      analysisResult: { decision: { label: 'manual_review' }, explanation: {} },
    });

    expect(qa.qualityFlags).toContain('missing_star_breakdown');
  });
});
