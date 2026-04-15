import { describe, expect, it } from 'vitest';
import { buildInterviewTurnPolicy } from '../../../src/services/interview/interviewTurnPolicy.js';

const buildSession = (aiTurns = [], level = 'junior', focusArea = 'Combined') => ({
  settings: { seniorityLevel: level, focusArea },
  transcript: aiTurns.map((turn) => ({ role: 'ai', text: turn.text || turn.topic, metadata: turn })),
});

describe('interviewTurnPolicy', () => {
  it('forces fresh anchors on turns 1, 4, and 7', () => {
    expect(buildInterviewTurnPolicy(buildSession([])).mustBeFreshQuestion).toBe(true);
    expect(buildInterviewTurnPolicy(buildSession([{ topic: 'self_intro', followUpDepth: 0 }])).mustBeFreshQuestion).toBe(false);
    expect(buildInterviewTurnPolicy(buildSession([
      { topic: 'self_intro', followUpDepth: 0 },
      { topic: 'self_intro', followUpDepth: 1 },
      { topic: 'self_intro', followUpDepth: 2 },
    ])).mustBeFreshQuestion).toBe(true);
  });

  it('forces technical coverage before turn 6 and behavioural before turn 7 in combined mode', () => {
    const technicalNeeded = buildInterviewTurnPolicy(buildSession([
      { topic: 'self_intro', followUpDepth: 0, questionCategory: 'opening' },
      { topic: 'project', followUpDepth: 0, questionCategory: 'experience' },
      { topic: 'project', followUpDepth: 1, questionCategory: 'experience' },
      { topic: 'teamwork', followUpDepth: 0, questionCategory: 'behavioural' },
      { topic: 'teamwork', followUpDepth: 1, questionCategory: 'behavioural' },
    ], 'Intermediate', 'Combined'));
    expect(technicalNeeded.forceCategory).toBe('technical');

    const behaviouralNeeded = buildInterviewTurnPolicy(buildSession([
      { topic: 'self_intro', followUpDepth: 0, questionCategory: 'opening' },
      { topic: 'project', followUpDepth: 0, questionCategory: 'experience' },
      { topic: 'project', followUpDepth: 1, questionCategory: 'experience' },
      { topic: 'javascript', followUpDepth: 0, questionCategory: 'technical' },
      { topic: 'javascript', followUpDepth: 1, questionCategory: 'technical' },
      { topic: 'sql', followUpDepth: 0, questionCategory: 'technical' },
    ], 'Intermediate', 'Combined'));
    expect(behaviouralNeeded.mustBeFreshQuestion).toBe(true);
    expect(behaviouralNeeded.requiredCategory).toBe('behavioural');
  });

  it('hard locks behavioural focus to behavioural coverage only', () => {
    const policy = buildInterviewTurnPolicy(buildSession([
      { topic: 'self_intro', followUpDepth: 0, questionCategory: 'opening' },
    ], 'Intermediate', 'Behavioral'));
    expect(policy.focusAreaKey).toBe('behavioral');
    expect(policy.forceCategory).toBe('behavioural');
  });

  it('hard locks technical focus to technical coverage only', () => {
    const policy = buildInterviewTurnPolicy(buildSession([
      { topic: 'self_intro', followUpDepth: 0, questionCategory: 'opening' },
    ], 'Intermediate', 'Technical'));
    expect(policy.focusAreaKey).toBe('technical');
    expect(policy.forceCategory).toBe('technical');
  });
});


  it('marks the final planned turn so the controller can close cleanly', () => {
    const policy = buildInterviewTurnPolicy(buildSession([
      { topic: 'self_intro', followUpDepth: 0, questionCategory: 'opening' },
      { topic: 'project', followUpDepth: 0, questionCategory: 'experience' },
      { topic: 'project', followUpDepth: 1, questionCategory: 'technical' },
      { topic: 'teamwork', followUpDepth: 0, questionCategory: 'behavioural' },
      { topic: 'teamwork', followUpDepth: 1, questionCategory: 'behavioural' },
      { topic: 'sql', followUpDepth: 0, questionCategory: 'technical' },
      { topic: 'motivation', followUpDepth: 0, questionCategory: 'experience' },
    ], 'Junior', 'Combined'));
    expect(policy.isFinalPlannedTurn).toBe(true);
    expect(policy.shouldCloseSoon).toBe(true);
  });
