import { describe, expect, it } from 'vitest';

import { buildRoleLockedQuestion } from '../../../src/services/agents/interviewerAgentQuestionBuilder.js';
import * as masterAiService from '../../../src/services/masterAiService.js';
import { buildCandidateReportProjection } from '../../../src/services/report/reportPublicationSummaryService.js';
import { inferTurnRubric } from '../../../src/services/report/turnRubricService.js';

const Q3 = 'Can you give me one practical example that shows your experience with data quality in manufacturing?';
const Q5 = 'Share a specific example where you collaborated with a business stakeholder to solve a problem. Start with the outcome, then explain your role.';
const IMPACT_FIRST_KEYS = [
  'outcome',
  'problem_solving',
  'personal_role',
  'approaches',
  'learning',
  'outcome_placement',
];

describe('impact-first screenshot reproductions', () => {
  it('routes Q3 to Impact-first after preserving role-locked metadata', () => {
    const selectedQuestion = buildRoleLockedQuestion({
      text: Q3,
      sourceType: 'question_bank',
      sourceId: 'q3-data-quality',
      metadata: {
        question: Q3,
        questionFamily: 'role_specific',
        evidenceMode: 'past_example',
      },
    }, {
      type: 'technical_evidence',
      stage: 'role_requirement',
      topic: 'data quality',
      category: 'technical',
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
    });
    const transcriptMetadata = masterAiService.buildQuestionTranscriptMetadata({
      ...selectedQuestion,
      nextQuestion: selectedQuestion.text,
      displayText: selectedQuestion.text,
    });
    const rubric = inferTurnRubric({ question: Q3, metadata: transcriptMetadata });

    expect(selectedQuestion.type).toBe('technical_evidence');
    expect(transcriptMetadata.questionFamily).toBe('role_specific');
    expect(transcriptMetadata.evidenceMode).toBe('past_example');
    expect(rubric.frameworkKey).toBe('impact_first_past_example');
    expect(rubric.dimensions).toHaveLength(6);
  });

  it('marks Q5 incomplete metrics for regeneration instead of presenting a verified report', () => {
    const projection = buildCandidateReportProjection({
      latestStatus: 'ready',
      report: {
        candidateFeedback: {
          turnBreakdowns: [{
            question: Q5,
            frameworkKey: 'impact_first_past_example',
            frameworkLabel: 'Impact-first Past Example',
            frameworkBreakdown: {
              normalizedScore: 4.6,
              dimensions: IMPACT_FIRST_KEYS.map((key) => ({
                key,
                status: 'partial',
                reason: 'The answer contains partial evidence.',
              })),
            },
          }],
        },
      },
    });
    expect(projection.latestStatus).toBe('needs_review');
    expect(projection.report.legacyLimitations).toEqual([
      expect.objectContaining({
        code: 'legacy_impact_first_metrics_unavailable',
        action: 'regenerate_report',
      }),
    ]);
    expect(projection.report.candidateFeedback.turnBreakdowns[0].frameworkBreakdown.dimensions)
      .toHaveLength(IMPACT_FIRST_KEYS.length);
  });
});
