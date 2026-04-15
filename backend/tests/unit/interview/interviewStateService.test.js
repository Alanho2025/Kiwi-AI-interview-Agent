import { describe, expect, it } from 'vitest';
import { getNextPoolQuestion } from '../../../src/services/interviewStateService.js';

const baseSession = {
  currentQuestionIndex: 3,
  totalQuestions: 8,
  interviewPlan: {
    questionPool: [
      { text: 'Intro question', topic: 'self_intro', type: 'self_intro', stage: 'opening', category: 'opening', followUpDepth: 0 },
      { text: 'Tell me about a time when you had to show Collaboration.', topic: 'teamwork', type: 'collaboration', stage: 'behavioural', category: 'behavioural', followUpDepth: 0 },
      { text: 'Tell me about a project where you used PostgreSQL.', topic: 'sql', type: 'technical_project', stage: 'technical', category: 'technical', followUpDepth: 0 },
    ],
  },
  transcript: [
    { role: 'ai', text: 'Intro question', metadata: { topic: 'self_intro', questionType: 'self_intro', questionCategory: 'opening', stage: 'opening', followUpDepth: 0 } },
    { role: 'ai', text: 'Tell me about a time when you had to show Collaboration.', metadata: { topic: 'teamwork', questionType: 'collaboration', questionCategory: 'behavioural', stage: 'behavioural', followUpDepth: 0 } },
  ],
};

describe('interviewStateService.getNextPoolQuestion', () => {
  it('does not replay the same root behavioural question after it has already been asked', () => {
    const next = getNextPoolQuestion(baseSession, { freshOnly: true, category: 'behavioural' });
    expect(next).toBeNull();
  });

  it('can still select a fresh technical question when recovering technical coverage', () => {
    const next = getNextPoolQuestion(baseSession, { freshOnly: true, category: 'technical' });
    expect(next?.topic).toBe('sql');
  });
});
