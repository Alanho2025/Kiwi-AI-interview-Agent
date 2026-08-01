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

  it('excludes question-scope turns while preserving the active root answer pair', () => {
    const dataset = buildReportTurnDataset([
      {
        role: 'ai',
        text: 'How do you use AI?',
        questionId: 'q-ai',
        metadata: { turnType: 'interview_question', countsAsQuestion: true },
      },
      {
        role: 'user',
        text: 'Do you mean personal use or project delivery?',
        metadata: {
          turnType: 'question_scope_clarification_request',
          countsAsQuestion: false,
          countsAsAnswer: false,
          rootQuestionId: 'q-ai',
        },
      },
      {
        role: 'ai',
        text: 'Please focus on project delivery.',
        questionId: 'q-ai',
        metadata: {
          turnType: 'question_scope_clarification',
          countsAsQuestion: false,
          countsAsAnswer: false,
          rootQuestionId: 'q-ai',
        },
      },
      {
        role: 'user',
        text: 'I used an agent to plan the feature, write tests, and verify the diff before merging.',
        metadata: { turnType: 'user_answer', countsAsAnswer: true },
      },
    ]);

    expect(dataset.countableQuestionCount).toBe(1);
    expect(dataset.scoredAnswerCount).toBe(1);
    expect(dataset.questionAnswerPairs[0]).toMatchObject({
      questionId: 'q-ai',
      answerTurn: { text: expect.stringContaining('plan the feature') },
    });
    expect(dataset.excludedUserTurnCount).toBe(1);
  });

  it('keeps a persisted candidate question out of the scored answer dataset', () => {
    const transcript = [
      { role: 'ai', text: 'Do you have any questions for us?', questionId: 'q-close', metadata: { turnType: 'interview_question', countsAsQuestion: true } },
      { role: 'user', text: 'What would success look like in this role?', metadata: { turnType: 'candidate_question', countsAsQuestion: true, countsAsAnswer: true } },
    ];

    const dataset = buildReportTurnDataset(transcript);

    expect(dataset.questionAnswerPairs).toEqual([]);
    expect(dataset.acceptedAnswers).toEqual([]);
    expect(dataset.scoredAnswerCount).toBe(0);
  });

  it('keeps a rhetorical question inside an accepted candidate answer', () => {
    const dataset = buildReportTurnDataset([
      { role: 'ai', text: 'How did you validate the change?', questionId: 'q-validation', metadata: { turnType: 'interview_question', countsAsQuestion: true } },
      { role: 'user', text: 'I asked, "What could fail?" and then ran the regression suite.', metadata: { turnType: 'user_answer', countsAsAnswer: true } },
    ]);

    expect(dataset.questionAnswerPairs).toHaveLength(1);
    expect(dataset.acceptedAnswers[0].text).toContain('What could fail?');
  });
});
