import { describe, expect, it } from 'vitest';

import { buildDeterministicTurnBreakdowns } from '../../../src/services/agents/reportGeneratorAgent.js';
import {
  analyseCandidateAnswers,
  buildInterviewMetrics,
} from '../../../src/services/agents/reportGenerator/reportEvidenceAnalysis.js';
import { buildReportTurnDataset } from '../../../src/services/report/reportTurnDatasetService.js';
import {
  constructiveReportPlannedQuestionCount,
  constructiveReportRegressionTranscript,
  repairTurnsThatMustNotCount,
} from '../../fixtures/report/constructiveReportRegressionFixture.js';

describe('report turn dataset', () => {
  it('does not count transcript confirmation turns as candidate answers', () => {
    const dataset = buildReportTurnDataset(constructiveReportRegressionTranscript);
    const metrics = buildInterviewMetrics(
      dataset,
      constructiveReportPlannedQuestionCount,
    );

    expect(dataset.questionAnswerPairs.map((pair) => pair.questionId)).toEqual([
      'q-validation',
      'q-friction',
      'q-ownership',
      'q-collaboration',
    ]);
    expect(dataset.repairTurnCount).toBe(2);
    expect(metrics).toMatchObject({
      candidateTurnCount: 4,
      interviewerQuestionCount: 4,
      scoredCandidateAnswerCount: 4,
      interviewCompletedByLimit: true,
    });
  });

  it('builds one scored breakdown for each countable question and accepted answer', () => {
    const dataset = buildReportTurnDataset(constructiveReportRegressionTranscript);
    const analysedAnswers = analyseCandidateAnswers(dataset.acceptedAnswers);

    const breakdowns = buildDeterministicTurnBreakdowns(
      dataset.questionAnswerPairs,
      analysedAnswers,
    );

    expect(breakdowns).toHaveLength(4);
    expect(breakdowns.map((turn) => turn.question)).not.toContain('Interview question');
    expect(breakdowns.map((turn) => turn.answer)).not.toContain('Yes, that is correct.');
  });

  it('does not score an unpaired repair response', () => {
    const dataset = buildReportTurnDataset(repairTurnsThatMustNotCount);

    expect(dataset.countableQuestionCount).toBe(0);
    expect(dataset.scoredAnswerCount).toBe(0);
  });
});
