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
