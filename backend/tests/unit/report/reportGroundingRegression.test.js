import { describe, expect, it } from 'vitest';
import { analyseCandidateAnswers, buildEvidenceSummary, buildInterviewMetrics } from '../../../src/services/agents/reportGenerator/reportEvidenceAnalysis.js';
import { buildReportDraft } from '../../../src/services/agents/reportGenerator/reportDraftBuilder.js';

describe('report grounding regressions', () => {
  it('keeps transcript counts aligned with report metrics', () => {
    const transcript = [
      { role: 'ai', text: 'Question 1?', metadata: { questionId: 'q1' } },
      { role: 'user', text: 'I think this is hard and I need to rephrase.' },
      { role: 'ai', text: 'Question 2?', metadata: { questionId: 'q2' } },
      { role: 'user', text: 'I built a JavaScript dashboard and checked the result manually.' },
    ];

    const metrics = buildInterviewMetrics(transcript, 2);

    expect(metrics.candidateTurnCount).toBe(2);
    expect(metrics.interviewerQuestionCount).toBe(2);
    expect(metrics.extraAiTurnCount).toBe(0);
    expect(metrics.interviewCompletedByLimit).toBe(true);
  });

  it('does not treat coaching rewrite metrics as real candidate evidence', () => {
    const candidateTurns = [
      { role: 'user', text: 'I think it was quite hard and I do not really understand the question.' },
    ];
    const evidenceSummary = buildEvidenceSummary(analyseCandidateAnswers(candidateTurns));
    const report = buildReportDraft({
      session: { id: 's1', targetRole: 'Software Engineer', totalQuestions: 1 },
      analysisResult: {
        candidateName: 'Candidate',
        jobTitle: 'Software Engineer',
        overallScore: 40,
        confidence: 0.8,
        decision: { label: 'weak_match' },
        explanation: { strengths: [], gaps: [] },
      },
      interviewPlan: { interviewFocus: ['JavaScript'] },
      explanation: { strengths: [], gaps: [] },
      evidenceSummary,
      interviewMetrics: { candidateTurnCount: 1, interviewerQuestionCount: 1, extraAiTurnCount: 0, plannedQuestionCount: 1, interviewCompletedByLimit: true },
      candidateFeedback: {
        answerRewriteExamples: [
          'Stronger version: I reduced defects by 12% after changing the process.',
        ],
        turnBreakdowns: [],
      },
    });

    const evidenceSection = report.sections.find((section) => section.id === 'evidence_examples');

    expect(evidenceSection.content).toBe('No high-strength interview examples were captured.');
    expect(evidenceSection.content).not.toMatch(/12%|reduced defects/i);
    expect(report.scores.directEvidenceTurns).toBe(0);
  });
});
