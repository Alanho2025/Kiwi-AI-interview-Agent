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

  it('hard-filters transcript duplicates while preserving their rejection reason', () => {
    const ranked = rankPreparedQuestionPool({
      poolItems: [{ ...poolItems[0], status: 'asked' }, poolItems[1]],
      session: {
        transcript: [{ role: 'ai', text: 'Tell me about database validation.', metadata: { topic: 'database' } }],
      },
      decisionContext: { interviewStructure: { focusAreaKey: 'combined' } },
    });

    expect(ranked[0].questionId).toBe('q-teamwork');
    expect(ranked.find((item) => item.questionId === 'q-validation')).toBeUndefined();
    expect(ranked.rejectedCandidates).toEqual([
      expect.objectContaining({ questionId: 'q-validation', reason: 'duplicate_fingerprint' }),
    ]);
    expect(ranked.deduplication).toEqual({
      dedupeIndexBuildMs: expect.any(Number),
      candidateNoveltyFilterMs: expect.any(Number),
    });
  });

  it('hard-filters an active candidate whose exact question already appears in the transcript', () => {
    const repeated = {
      ...poolItems[0],
      status: 'active',
      text: 'Tell me about a time you showed ownership.',
      topic: 'ownership',
      category: 'behavioural',
      questionFamily: 'behavioural',
      priorityWeight: 1,
      coverageWeight: 1,
      riskWeight: 1,
    };
    const ranked = rankPreparedQuestionPool({
      poolItems: [repeated, poolItems[1]],
      session: {
        transcript: [{
          role: 'ai',
          text: repeated.text,
          questionId: 'asked-ownership',
          metadata: {
            topic: 'ownership',
            questionFamily: 'behavioural',
            turnKind: 'root_question',
            turnType: 'interview_question',
            countsAsQuestion: true,
          },
        }],
      },
      decisionContext: { interviewStructure: { focusAreaKey: 'combined' } },
    });

    expect(ranked.map((item) => item.questionId)).toEqual(['q-teamwork']);
    expect(ranked.rejectedCandidates).toEqual([
      expect.objectContaining({ questionId: 'q-validation', reason: 'duplicate_fingerprint' }),
    ]);
    expect(selectBestPreparedQuestion(ranked).questionId).toBe('q-teamwork');
  });

  it('keeps a distinct follow-up goal on an already covered topic', () => {
    const ranked = rankPreparedQuestionPool({
      poolItems: [{
        questionId: 'ownership-result',
        status: 'active',
        topic: 'ownership',
        rootQuestionId: 'ownership-root',
        rootTopic: 'ownership',
        turnKind: 'follow_up',
        followUpDepth: 1,
        followUpIntent: 'result',
        evidenceTarget: 'result_or_impact',
        text: 'What result came from your actions?',
        priorityWeight: 0.7,
        coverageWeight: 0.7,
        riskWeight: 0.4,
        modeCompatibility: { behavioural: true, combined: true },
      }],
      session: {
        transcript: [{
          role: 'ai',
          text: 'Tell me about a time you showed ownership.',
          questionId: 'ownership-root',
          metadata: {
            topic: 'ownership',
            questionFamily: 'behavioural',
            turnKind: 'root_question',
            turnType: 'interview_question',
            countsAsQuestion: true,
          },
        }],
      },
      decisionContext: { interviewStructure: { focusAreaKey: 'combined' } },
    });

    expect(ranked).toHaveLength(1);
    expect(ranked[0].questionId).toBe('ownership-result');
  });
});
