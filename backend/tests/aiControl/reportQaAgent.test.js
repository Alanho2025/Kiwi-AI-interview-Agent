import { describe, expect, it } from 'vitest';
import { runReportQaAgent } from '../../src/services/agents/reportQaAgent.js';

describe('runReportQaAgent', () => {
  it('flags unsupported and incomplete report outputs', async () => {
    const qa = await runReportQaAgent({
      report: {
        sessionId: 'session-1',
        summary: 'The candidate is strong overall.',
        sections: [
          { id: 'strengths', title: 'Strengths', content: '' },
          { id: 'gaps', title: 'Gaps', content: 'Needs more project detail.' },
        ],
        evidenceReferences: [],
        interviewMetrics: {
          interviewerQuestionCount: 3,
          plannedQuestionCount: 4,
          candidateTurnCount: 3,
        },
        evidenceDiagnostics: {
          averageStrength: 2,
          totals: { hypothetical_understanding: 1 },
        },
        candidateFeedback: {
          overallTakeaway: '',
          plainEnglishMetrics: [],
          coachingAdvice: [],
          answerRewriteExamples: [],
        },
      },
      analysisResult: {
        decision: { label: 'manual_review' },
        explanation: { strengths: ['Node.js basics'] },
      },
      retrievalBundle: { items: [] },
    });

    expect(qa.passed).toBe(false);
    expect(qa.qualityFlags).toContain('missing_strength_coverage');
    expect(qa.qualityFlags).toContain('question_count_mismatch');
    expect(qa.qualityFlags).toContain('missing_candidate_feedback');
  });
});
