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

  it('builds one scored breakdown for each countable question and accepted answer', async () => {
    const dataset = buildReportTurnDataset(constructiveReportRegressionTranscript);
    const analysedAnswers = analyseCandidateAnswers(dataset.acceptedAnswers);

    const breakdowns = await buildDeterministicTurnBreakdowns(
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

  it('assesses only substantive root voice answers and keeps follow-ups/text outside duration scoring', () => {
    const dataset = buildReportTurnDataset([
      {
        role: 'ai',
        text: 'Tell me about a project you delivered?',
        questionId: 'q-root-duration',
        metadata: {
          turnType: 'interview_question',
          countsAsQuestion: true,
          turnKind: 'root_question',
          followUpDepth: 0,
          questionFamily: 'past_example',
        },
      },
      {
        role: 'user',
        text: 'The project reduced processing time by 40 percent after I changed the workflow.',
        metadata: {
          inputMode: 'realtime_voice',
          turnType: 'user_answer',
          countsAsAnswer: true,
          transcriptAcceptance: { accepted: true },
          voiceDelivery: { speakingDurationSeconds: 100 },
        },
      },
      {
        role: 'ai',
        text: 'What did you validate next?',
        questionId: 'q-follow-up-duration',
        metadata: {
          turnType: 'interview_question',
          countsAsQuestion: true,
          turnKind: 'follow_up',
          followUpDepth: 1,
          questionFamily: 'past_example',
        },
      },
      {
        role: 'user',
        text: 'I checked the regression result.',
        metadata: {
          inputMode: 'realtime_voice',
          turnType: 'user_answer',
          countsAsAnswer: true,
          transcriptAcceptance: { accepted: true },
          voiceDelivery: { speakingDurationSeconds: 30 },
        },
      },
      {
        role: 'ai',
        text: 'How would you explain the same approach in text?',
        questionId: 'q-text-duration',
        metadata: {
          turnType: 'interview_question',
          countsAsQuestion: true,
          turnKind: 'root_question',
          followUpDepth: 0,
          questionFamily: 'scenario',
        },
      },
      {
        role: 'user',
        text: 'I would compare the options and explain the trade-off.',
        metadata: {
          inputMode: 'text',
          turnType: 'user_answer',
          countsAsAnswer: true,
          transcriptAcceptance: { accepted: true },
          voiceDelivery: { speakingDurationSeconds: 100 },
        },
      },
    ]);

    expect(dataset.questionAnswerPairs).toHaveLength(3);
    expect(dataset.questionAnswerPairs.map((pair) => pair.questionTurnKind)).toEqual([
      'root_question',
      'follow_up',
      'root_question',
    ]);
    expect(dataset.questionAnswerPairs.map((pair) => pair.voiceDurationAssessment)).toEqual([
      expect.objectContaining({ eligible: true, level: 5, earnedPoints: 10 }),
      expect.objectContaining({ eligible: false, reason: 'non_root_question', earnedPoints: null }),
      expect.objectContaining({ eligible: false, reason: 'text_timing_deferred', earnedPoints: null }),
    ]);
    expect(dataset.voiceDurationAssessmentSummary).toMatchObject({
      eligibleAnswerCount: 1,
      notApplicableAnswerCount: 2,
      averageEligibleDurationSeconds: 100,
    });
  });

  it('does not create duration assessments for unconfirmed answers or excluded repair/candidate-question turns', () => {
    const dataset = buildReportTurnDataset([
      {
        role: 'ai',
        text: 'Tell me about a real example?',
        questionId: 'q-unconfirmed',
        metadata: { turnType: 'interview_question', countsAsQuestion: true, turnKind: 'root_question' },
      },
      {
        role: 'user',
        text: 'The transcript needs confirmation before scoring.',
        metadata: {
          inputMode: 'realtime_voice',
          turnType: 'user_answer',
          countsAsAnswer: true,
          transcriptReviewDecision: {
            decisionType: 'immediate_confirmation',
            scoringPolicy: 'block_scoring_until_confirmed',
          },
          transcriptConfirmation: { confirmedByUser: false },
          voiceDelivery: { speakingDurationSeconds: 100 },
        },
      },
      {
        role: 'ai',
        text: 'Do you have any questions for us?',
        questionId: 'q-candidate-question',
        metadata: { turnType: 'interview_question', countsAsQuestion: true, turnKind: 'root_question' },
      },
      {
        role: 'user',
        text: 'What would success look like in this role?',
        metadata: {
          inputMode: 'realtime_voice',
          turnType: 'candidate_question',
          countsAsQuestion: true,
          countsAsAnswer: true,
          voiceDelivery: { speakingDurationSeconds: 100 },
        },
      },
      {
        role: 'ai',
        text: 'Tell me about a project where you improved an outcome.',
        questionId: 'q-valid-after-exclusion',
        metadata: { turnType: 'interview_question', countsAsQuestion: true, turnKind: 'root_question' },
      },
      {
        role: 'ai',
        text: 'Please give a fuller answer.',
        metadata: { turnType: 'repair_prompt', countsAsQuestion: false },
      },
      {
        role: 'user',
        text: 'I will explain the project outcome and what I learned.',
        metadata: {
          inputMode: 'realtime_voice',
          turnType: 'user_answer',
          countsAsAnswer: true,
          transcriptAcceptance: { accepted: true },
          voiceDelivery: { speakingDurationSeconds: 90 },
        },
      },
    ]);

    expect(dataset.questionAnswerPairs).toHaveLength(1);
    expect(dataset.questionAnswerPairs[0].questionId).toBe('q-valid-after-exclusion');
    expect(dataset.questionAnswerPairs[0].voiceDurationAssessment).toMatchObject({
      eligible: true,
      seconds: 90,
      level: 5,
    });
    expect(dataset.questionAnswerPairs.map((pair) => pair.answerTurn.text)).not.toContain('The transcript needs confirmation before scoring.');
    expect(dataset.questionAnswerPairs.map((pair) => pair.answerTurn.text)).not.toContain('What would success look like in this role?');
  });

  it('scores a confirmed contentful voice answer after transcript confirmation', () => {
    const dataset = buildReportTurnDataset([
      {
        role: 'ai',
        text: 'Tell me about a production issue you resolved.',
        questionId: 'q-confirmed-duration',
        metadata: { turnType: 'interview_question', countsAsQuestion: true, turnKind: 'root_question' },
      },
      {
        role: 'user',
        text: 'I confirmed the transcript and the answer is accurate.',
        metadata: {
          inputMode: 'realtime_voice',
          turnType: 'user_answer',
          countsAsAnswer: true,
          transcriptReviewDecision: {
            decisionType: 'immediate_confirmation',
            scoringPolicy: 'block_scoring_until_confirmed',
          },
          transcriptConfirmation: { confirmedByUser: true },
          voiceDelivery: { speakingDurationSeconds: 100 },
        },
      },
    ]);

    expect(dataset.questionAnswerPairs).toHaveLength(1);
    expect(dataset.questionAnswerPairs[0].voiceDurationAssessment).toMatchObject({
      eligible: true,
      seconds: 100,
      level: 5,
      earnedPoints: 10,
    });
  });

  it.each([
    'repeat_request',
    'acknowledgement',
    'clarification',
    'transcript_confirmation_response',
  ])('keeps excluded %s turns out of duration assessment', (turnType) => {
      const dataset = buildReportTurnDataset([
        {
          role: 'ai',
          text: 'Tell me about a measurable project outcome.',
          questionId: `q-excluded-${turnType}`,
          metadata: { turnType: 'interview_question', countsAsQuestion: true, turnKind: 'root_question' },
        },
        {
          role: 'user',
          text: `This is a ${turnType} and not a substantive answer.`,
          metadata: {
            inputMode: 'realtime_voice',
            turnType,
            countsAsAnswer: true,
            voiceDelivery: { speakingDurationSeconds: 100 },
          },
        },
        {
          role: 'user',
          text: 'The accepted answer explains the action, validation, and measurable result.',
          metadata: {
            inputMode: 'realtime_voice',
            turnType: 'user_answer',
            countsAsAnswer: true,
            transcriptAcceptance: { accepted: true },
            voiceDelivery: { speakingDurationSeconds: 90 },
          },
        },
      ]);

      expect(dataset.questionAnswerPairs).toHaveLength(1);
      expect(dataset.questionAnswerPairs[0].answerTurn.text).toContain('accepted answer');
      expect(dataset.questionAnswerPairs[0].voiceDurationAssessment).toMatchObject({
        eligible: true,
        seconds: 90,
        level: 5,
      });
    });
});
