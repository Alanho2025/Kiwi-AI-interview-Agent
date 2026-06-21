import { describe, expect, it } from 'vitest';

import {
  buildAssessmentKey,
  buildQuestionFingerprint,
  buildQuestionHistory,
  evaluateQuestionNovelty,
  filterNovelQuestionCandidates,
} from '../../../src/services/questions/questionDeduplicationService.js';

const ownershipQuestion = 'Tell me about a time you showed ownership. What was the situation, what did you do, and what changed afterwards?';
const collaborationQuestion = 'Tell me about a time when you had to show Collaboration.?';

const rootTurn = ({ text, topic, questionFamily = 'behavioural', questionId = null }) => ({
  role: 'ai',
  text,
  questionId,
  metadata: {
    topic,
    questionFamily,
    turnKind: 'root_question',
    turnType: 'interview_question',
    countsAsQuestion: true,
    followUpDepth: 0,
  },
});

describe('question deduplication contract', () => {
  it('normalizes punctuation, spacing, spelling, and case into one fingerprint', () => {
    expect(buildQuestionFingerprint('  Behavioural: TEAMWORK?! '))
      .toBe(buildQuestionFingerprint('behavioral teamwork'));
  });

  it.each([
    ['ownership', ownershipQuestion],
    ['collaboration', collaborationQuestion],
  ])('rejects the repeated %s question from the supplied regression transcript', (topic, text) => {
    const history = buildQuestionHistory([rootTurn({ text, topic, questionId: `${topic}-1` })]);
    const result = evaluateQuestionNovelty({
      candidate: { topic, questionFamily: 'behavioural', turnKind: 'root_question', text },
      spokenText: text,
      history,
    });

    expect(result).toMatchObject({
      allowed: false,
      reason: 'duplicate_fingerprint',
      matchedQuestionId: `${topic}-1`,
    });
  });

  it('rejects a reworded root question with an equivalent canonical topic', () => {
    const history = buildQuestionHistory([
      rootTurn({ text: ownershipQuestion, topic: 'ownership', questionId: 'ownership-1' }),
    ]);
    const result = evaluateQuestionNovelty({
      candidate: {
        topic: 'accountability',
        questionFamily: 'behavioural',
        turnKind: 'root_question',
        text: 'Describe an example where you took accountability for an outcome.',
      },
      history,
    });

    expect(buildAssessmentKey({ topic: 'accountability', questionFamily: 'behavioural', turnKind: 'root_question' }))
      .toBe('root:ownership:behavioural');
    expect(result).toMatchObject({ allowed: false, reason: 'duplicate_assessment_key' });
  });

  it('allows a new result follow-up on an existing ownership root', () => {
    const history = buildQuestionHistory([
      rootTurn({ text: ownershipQuestion, topic: 'ownership', questionId: 'ownership-1' }),
    ]);
    const result = evaluateQuestionNovelty({
      candidate: {
        topic: 'ownership',
        rootQuestionId: 'ownership-1',
        rootTopic: 'ownership',
        turnKind: 'follow_up',
        followUpDepth: 1,
        followUpIntent: 'result',
        evidenceTarget: 'result_or_impact',
        text: 'What result came from your actions?',
      },
      history,
    });

    expect(result.allowed).toBe(true);
  });

  it('rejects a repeated follow-up intent and evidence target under the same root', () => {
    const firstFollowUp = {
      role: 'ai',
      text: 'What result came from your actions?',
      questionId: 'result-1',
      metadata: {
        topic: 'ownership',
        rootQuestionId: 'ownership-1',
        rootTopic: 'ownership',
        turnKind: 'follow_up',
        turnType: 'interview_question',
        countsAsQuestion: true,
        followUpDepth: 1,
        followUpIntent: 'result',
        evidenceTarget: 'result_or_impact',
      },
    };
    const history = buildQuestionHistory([firstFollowUp]);
    const result = evaluateQuestionNovelty({
      candidate: {
        rootQuestionId: 'ownership-1',
        rootTopic: 'ownership',
        turnKind: 'follow_up',
        followUpDepth: 2,
        followUpIntent: 'result',
        evidenceTarget: 'result_or_impact',
        text: 'How did the outcome affect the team?',
      },
      history,
    });

    expect(result).toMatchObject({ allowed: false, reason: 'duplicate_assessment_key' });
  });

  it('keeps repair questions in spoken history but outside countable history and ignores system messages', () => {
    const history = buildQuestionHistory([
      rootTurn({ text: ownershipQuestion, topic: 'ownership', questionId: 'ownership-1' }),
      {
        role: 'ai',
        text: 'Let me rephrase that. Can you choose one specific example?',
        questionId: 'ownership-1',
        metadata: {
          parentQuestionId: 'ownership-1',
          scenario: 'rephrase',
          turnKind: 'repair',
          turnType: 'repair_prompt',
          countsAsQuestion: false,
        },
      },
      { role: 'ai', text: 'Processing your answer.', metadata: { turnType: 'system', countsAsQuestion: false } },
    ]);

    expect(history.spokenQuestions).toHaveLength(2);
    expect(history.countableQuestions).toHaveLength(1);
    expect(history.repairQuestions).toHaveLength(1);
  });

  it('returns accepted candidates and transparent rejection traces', () => {
    const history = buildQuestionHistory([
      rootTurn({ text: ownershipQuestion, topic: 'ownership', questionId: 'ownership-1' }),
    ]);
    const result = filterNovelQuestionCandidates({
      candidates: [
        { questionId: 'duplicate', topic: 'ownership', questionFamily: 'behavioural', text: ownershipQuestion },
        { questionId: 'novel', topic: 'documentation', questionFamily: 'behavioural', text: 'Tell me about documentation you improved.' },
      ],
      history,
    });

    expect(result.accepted.map((item) => item.questionId)).toEqual(['novel']);
    expect(result.rejected).toEqual([
      expect.objectContaining({ questionId: 'duplicate', reason: 'duplicate_fingerprint' }),
    ]);
  });
});
