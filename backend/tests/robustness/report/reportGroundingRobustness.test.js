import { describe, expect, it } from 'vitest';

import { runReportQaAgent } from '../../../src/services/agents/reportQaAgent.js';

describe('report grounding robustness', () => {
  it('flags sparse or unsupported reports instead of passing them as useful feedback', async () => {
    const qa = await runReportQaAgent({
      report: {
        id: 'r1',
        summary: 'The candidate is excellent for this role.',
        sections: [],
        evidenceReferences: [],
        interviewMetrics: { plannedQuestionCount: 5, interviewerQuestionCount: 2, candidateTurnCount: 1 },
        candidateFeedback: {},
        scores: {},
      },
      analysisResult: { decision: { label: 'manual_review' }, explanation: { strengths: ['SQL'] } },
      retrievalBundle: { items: [] },
    });

    expect(qa.passed).toBe(false);
    expect(qa.qualityFlags).toEqual(expect.arrayContaining([
      'missing_sections',
      'missing_interaction_section',
      'missing_candidate_feedback',
      'question_count_mismatch',
    ]));
    expect(qa.consistencyChecks.find((item) => item.rule === 'evidence_presence').passed).toBe(false);
  });
});
