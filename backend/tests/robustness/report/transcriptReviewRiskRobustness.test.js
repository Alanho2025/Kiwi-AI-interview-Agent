import { describe, expect, it } from 'vitest';

import { detectReportTranscriptRisks } from '../../../src/services/report/reportTranscriptRiskService.js';
import { buildReportTurnDataset } from '../../../src/services/report/reportTurnDatasetService.js';

const aiQuestion = {
  id: 'question-database',
  role: 'ai',
  text: 'How did you decide between MongoDB and PostgreSQL?',
  metadata: { countsAsQuestion: true },
};

describe('transcript review risk reporting', () => {
  it('surfaces deferred transcript review items as report risks', () => {
    const transcript = [
      aiQuestion,
      {
        id: 'answer-database',
        role: 'user',
        text: 'I used SRE team during the incident response.',
        metadata: {
          turnType: 'user_answer',
          countsAsQuestion: true,
          transcriptReviewDecision: {
            decisionType: 'deferred_review',
            riskLevel: 'medium',
            reasonCodes: ['no_provider_evidence'],
            reviewItems: [{
              id: 'review-1',
              display: {
                rawSnippet: 'history team',
                proposedSnippet: 'SRE team',
                reasonLabel: 'technical term unclear',
                riskLabel: 'Medium transcript risk',
              },
            }],
          },
        },
      },
    ];

    const risks = detectReportTranscriptRisks({ transcript });

    expect(risks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: 'deferred_transcript_review',
        needsUserConfirmation: false,
        affectedTurnIds: ['answer-database'],
      }),
    ]));
  });

  it('does not score an unconfirmed high-risk transcript turn', () => {
    const dataset = buildReportTurnDataset([
      aiQuestion,
      {
        id: 'answer-database',
        role: 'user',
        text: 'I chose PostgreSQL over MongoDB.',
        metadata: {
          turnType: 'user_answer',
          countsAsQuestion: true,
          transcriptReviewDecision: {
            decisionType: 'immediate_confirmation',
            riskLevel: 'high',
            scoringPolicy: 'block_scoring_until_confirmed',
            reasonCodes: ['technical_choice_change'],
          },
        },
      },
    ]);

    expect(dataset.scoredAnswerCount).toBe(0);
    expect(dataset.repairTurnCount).toBeGreaterThanOrEqual(1);
  });
});
