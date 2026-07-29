import { describe, expect, it } from 'vitest';

import { resolveInterviewSessionConfig } from '../../../src/services/interview/interviewSessionConfigResolver.js';
import { buildInterviewTurnPolicy } from '../../../src/services/interview/interviewTurnPolicy.js';
import { getResolvedTotalQuestions, hasReachedQuestionLimit } from '../../../src/services/interviewStateService.js';
import {
  guardGeneratedTextForInterviewMode,
  guardQuestionForInterviewMode,
  questionLooksBehavioural,
} from '../../../src/services/aiControl/interviewModeGuard.js';
import { normalizeSeniorityLevelKey, resolveInterviewModeConfig } from '../../../src/config/interviewBlueprints.js';

describe('interview setting contract guard', () => {
  it('resolves 15-minute sessions as time-boxed interviews with 8 planned questions', () => {
    const config = resolveInterviewSessionConfig({
      controlMode: 'time_limited',
      timeLimitSeconds: 900,
      settings: { focusArea: 'combined', seniorityLevel: 'junior' },
    });

    expect(config.sessionContractType).toBe('time_boxed');
    expect(config.estimatedMinutes).toBe(15);
    expect(config.plannedQuestionCount).toBe(8);
    expect(getResolvedTotalQuestions({ controlMode: 'time_limited', timeLimitSeconds: 900 })).toBe(8);
  });

  it('resolves 30-minute sessions as time-boxed interviews with 15 planned questions', () => {
    const config = resolveInterviewSessionConfig({
      controlMode: 'time_limited',
      timeLimitSeconds: 1800,
      settings: { questionType: 'technical', level: 'advanced' },
    });

    expect(config.sessionContractType).toBe('time_boxed');
    expect(config.estimatedMinutes).toBe(30);
    expect(config.plannedQuestionCount).toBe(15);
    expect(config.questionType).toBe('technical');
  });

  it('writes Senior as the canonical level while continuing to read legacy Advanced sessions', () => {
    expect(normalizeSeniorityLevelKey('Senior')).toBe('senior');
    expect(normalizeSeniorityLevelKey('Advanced')).toBe('senior');
    expect(resolveInterviewModeConfig({ seniorityLevel: 'Advanced' })).toMatchObject({
      level: 'senior',
      seniorityKey: 'senior',
      interviewModeKey: 'senior_combined_question_limited',
    });
  });

  it('does not let question-limited 12 or 15 question sessions fall back to the default 8', () => {
    expect(getResolvedTotalQuestions({ controlMode: 'question_limited', questionLimit: 12 })).toBe(12);
    expect(getResolvedTotalQuestions({ controlMode: 'question_limited', totalQuestions: 15 })).toBe(15);
    expect(hasReachedQuestionLimit({ controlMode: 'question_limited', questionLimit: 12, currentQuestionIndex: 8 })).toBe(false);
  });

  it('builds turn policy from the resolved session config instead of seniority-only defaults', () => {
    const policy = buildInterviewTurnPolicy({
      controlMode: 'question_limited',
      questionLimit: 12,
      currentQuestionIndex: 8,
      settings: { focusArea: 'combined', seniorityLevel: 'junior' },
      transcript: Array.from({ length: 7 }, (_, index) => ({
        role: 'ai',
        text: `Question ${index + 1}`,
        metadata: { questionCategory: index % 2 ? 'behavioural' : 'technical', stage: index % 2 ? 'behavioural' : 'technical_core' },
      })),
    });

    expect(policy.blueprint.plannedQuestionCount).toBe(12);
    expect(policy.isFinalPlannedTurn).toBe(false);
  });

  it('guards technical mode against pure behavioural final wording', () => {
    const selectedQuestion = {
      category: 'behavioural',
      stage: 'behavioural',
      topic: 'teamwork',
      text: 'Tell me about a time you handled conflict in a team.',
    };
    const guardedQuestion = guardQuestionForInterviewMode({
      focusArea: 'technical',
      selectedQuestion,
      targetTopic: 'React performance',
    });

    expect(guardedQuestion.category).toBe('technical');
    expect(questionLooksBehavioural(guardedQuestion)).toBe(false);

    const guardedText = guardGeneratedTextForInterviewMode({
      focusArea: 'technical',
      generatedText: 'Tell me about a time you handled conflict in a team.',
      fallbackText: guardedQuestion.text,
      selectedQuestion: guardedQuestion,
    });

    expect(guardedText).toMatch(/technical approach|implementation|tools/i);
    expect(guardedText).not.toMatch(/tell me about a time/i);
  });
});
