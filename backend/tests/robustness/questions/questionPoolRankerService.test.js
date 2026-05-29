import { describe, expect, it } from 'vitest';
import {
  rankPreparedQuestionPool,
  selectBestPreparedQuestion,
} from '../../../src/services/questions/questionPoolRankerService.js';

describe('questionPoolRankerService', () => {
  const poolItems = [
    {
      questionId: 'q-validation',
      status: 'active',
      topic: 'database',
      category: 'technical',
      sourceType: 'match_gap',
      sourceStage: 'match_gap',
      text: 'Tell me about database validation.',
      priorityWeight: 0.8,
      coverageWeight: 0.8,
      riskWeight: 0.9,
      modeCompatibility: { technical: true, behavioural: false, combined: true },
    },
    {
      questionId: 'q-teamwork',
      status: 'active',
      topic: 'teamwork',
      category: 'behavioural',
      sourceType: 'cv_behavioural',
      text: 'Tell me about teamwork.',
      priorityWeight: 0.7,
      coverageWeight: 0.5,
      riskWeight: 0.3,
      modeCompatibility: { technical: false, behavioural: true, combined: true },
    },
  ];

  it('prefers missing validation targets', () => {
    const ranked = rankPreparedQuestionPool({
      poolItems,
      session: { id: 'session-1', currentQuestionIndex: 2, questionLimit: 8, transcript: [] },
      decisionContext: {
        interviewStructure: { focusAreaKey: 'technical' },
        matchState: { validationTargets: ['database'] },
        coverageState: { missingTopics: ['database'] },
      },
      actionInput: { actionType: 'ASK_VALIDATION_QUESTION' },
    });

    expect(ranked[0].questionId).toBe('q-validation');
    expect(selectBestPreparedQuestion(ranked).questionId).toBe('q-validation');
  });

  it('respects technical-only and behavioural-only modes', () => {
    const technicalRanked = rankPreparedQuestionPool({
      poolItems,
      session: { transcript: [] },
      decisionContext: { interviewStructure: { focusAreaKey: 'technical' } },
    });
    expect(selectBestPreparedQuestion(technicalRanked).category).toBe('technical');

    const behaviouralRanked = rankPreparedQuestionPool({
      poolItems,
      session: { transcript: [] },
      decisionContext: { interviewStructure: { focusAreaKey: 'behavioural' } },
    });
    expect(selectBestPreparedQuestion(behaviouralRanked).category).toBe('behavioural');
  });

  it('penalizes repeated topics and already asked questions', () => {
    const ranked = rankPreparedQuestionPool({
      poolItems: [{ ...poolItems[0], status: 'asked' }, poolItems[1]],
      session: {
        transcript: [{ role: 'ai', text: 'Tell me about database validation.', metadata: { topic: 'database' } }],
      },
      decisionContext: { interviewStructure: { focusAreaKey: 'combined' } },
    });

    expect(ranked[0].questionId).toBe('q-teamwork');
    expect(ranked.find((item) => item.questionId === 'q-validation').penalties).toEqual(expect.arrayContaining(['already_asked', 'repeated_topic']));
  });
});
