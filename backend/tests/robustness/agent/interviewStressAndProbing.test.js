import { describe, expect, it } from 'vitest';
import {
  guardGeneratedTextForInterviewMode,
  guardQuestionForInterviewMode,
  normalizeInterviewMode,
  questionLooksBehavioural,
  questionLooksTechnical,
} from '../../../src/services/aiControl/interviewModeGuard.js';

describe('Phase 1 - F-73 & F-74: Interview Stress Mode & Tradeoff Probing Guards', () => {
  it('normalizes interview mode options strictly to technical, behavioral, or combined', () => {
    expect(normalizeInterviewMode('technical')).toBe('technical');
    expect(normalizeInterviewMode('behavioural')).toBe('behavioral');
    expect(normalizeInterviewMode('unknown_mode')).toBe('combined');
  });

  it('detects technical implementation probes vs STAR behavioral questions', () => {
    const techQuestion = { text: 'Walk me through your database schema indexing and SQL query optimization.' };
    const behavioralQuestion = { text: 'Tell me about a time when you had a conflict with a team member.' };

    expect(questionLooksTechnical(techQuestion)).toBe(true);
    expect(questionLooksTechnical(behavioralQuestion)).toBe(false);

    expect(questionLooksBehavioural(behavioralQuestion)).toBe(true);
    expect(questionLooksBehavioural(techQuestion)).toBe(false);
  });

  it('rewrites technical probes to STAR behavioral follow-ups when focusArea is behavioral', () => {
    const technicalQuestion = {
      type: 'technical_core',
      stage: 'technical',
      topic: 'postgresql',
      text: 'Walk me through your PostgreSQL query optimization and indexing strategy.',
    };

    const guarded = guardQuestionForInterviewMode({
      focusArea: 'behavioral',
      actionType: 'ask_technical_question',
      selectedQuestion: technicalQuestion,
      targetTopic: 'postgresql',
      latestAnswer: 'I used PostgreSQL for data storage.',
    });

    expect(guarded.modeGuardApplied).toBe(true);
    expect(guarded.category).toBe('behavioural');
    expect(guarded.text).toContain('project as context');
  });

  it('replaces technical implementation text in generated responses when behavioral mode is enforced', () => {
    const generatedText = 'Walk me through your python libraries and database query implementation details.';
    const fallbackText = 'Can you describe a challenge you faced during that project?';

    const result = guardGeneratedTextForInterviewMode({
      focusArea: 'behavioral',
      generatedText,
      fallbackText,
    });

    expect(result).toBe(fallbackText);
  });
});
