import { describe, expect, it } from 'vitest';

import { buildInterviewStructure } from '../../../src/services/interview/interviewTurnPolicy.js';
import { getNextPoolQuestion, hasReachedQuestionLimit } from '../../../src/services/interviewStateService.js';

const interviewQuestion = ({ text, topic, questionType = 'behavioural', questionId = null }) => ({
  role: 'ai',
  text,
  questionId,
  metadata: {
    topic,
    questionType,
    questionCategory: 'behavioural',
    turnKind: 'root_question',
    turnType: 'interview_question',
    countsAsQuestion: true,
    followUpDepth: 0,
  },
});

describe('interview question counting and legacy novelty', () => {
  it('keeps repair prompts outside the planned question count', () => {
    const session = {
      totalQuestions: 8,
      transcript: [
        interviewQuestion({ text: 'Tell me about one ownership example?', topic: 'ownership', questionId: 'q1' }),
        { role: 'user', text: 'I am not sure what ownership means.' },
        {
          role: 'ai',
          text: 'Let me rephrase that. What did you personally take responsibility for?',
          questionId: 'q1',
          metadata: {
            parentQuestionId: 'q1',
            scenario: 'rephrase',
            turnKind: 'repair',
            turnType: 'repair_prompt',
            countsAsQuestion: false,
          },
        },
        { role: 'user', text: 'I owned the frontend delivery.' },
      ],
    };

    const structure = buildInterviewStructure(session);
    expect(structure.askedQuestions).toHaveLength(1);
    expect(structure.spokenQuestionHistory).toHaveLength(2);
    expect(structure.repairHistory).toHaveLength(1);
    expect(structure.nextTurnIndex).toBe(2);
  });

  it('does not finish a question-limited session because repair answers increased user-turn count', () => {
    const session = {
      totalQuestions: 2,
      currentQuestionIndex: 1,
      transcript: [
        interviewQuestion({ text: 'Tell me about one ownership example?', topic: 'ownership', questionId: 'q1' }),
        { role: 'user', text: 'Could you explain that?' },
        { role: 'ai', text: 'Choose one example you personally owned?', metadata: { turnKind: 'repair', turnType: 'repair_prompt', countsAsQuestion: false } },
        { role: 'user', text: 'I owned the frontend delivery.' },
      ],
    };

    expect(hasReachedQuestionLimit(session)).toBe(false);
  });

  it('rejects a legacy pool duplicate even when it is older than the last three questions', () => {
    const repeatedText = 'Tell me about a time when you had to show Collaboration.?';
    const novelText = 'Tell me about documentation you improved?';
    const session = {
      totalQuestions: 8,
      currentQuestionIndex: 1,
      transcript: [
        interviewQuestion({ text: repeatedText, topic: 'collaboration', questionType: 'cv_behavioural', questionId: 'old-q' }),
        interviewQuestion({ text: 'What attracted you to this role?', topic: 'motivation', questionId: 'q2' }),
        interviewQuestion({ text: 'Tell me about an automation task?', topic: 'automation', questionId: 'q3' }),
        interviewQuestion({ text: 'What was the hardest technical decision?', topic: 'technical_decision', questionId: 'q4' }),
      ],
      interviewPlan: {
        questionPool: [
          { type: 'self_intro', category: 'opening', topic: 'self_intro', text: 'Please introduce yourself?' },
          { type: 'behavioural', category: 'behavioural', topic: 'collaboration', text: repeatedText, followUpDepth: 0 },
          { type: 'behavioural', category: 'behavioural', topic: 'documentation', text: novelText, followUpDepth: 0 },
        ],
      },
    };

    expect(getNextPoolQuestion(session)?.text).toBe(novelText);
  });
});
