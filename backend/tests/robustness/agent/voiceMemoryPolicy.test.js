import { describe, expect, it } from 'vitest';
import { shouldUseFollowUpMemoryFastPath } from '../../../src/services/aiControl/decisionContextBuilder.js';

const voiceSession = {
  id: 'voice-memory-policy-session',
  userId: 'voice-user',
  inputMode: 'realtime_voice',
  mode: 'voice',
  settings: { voiceMode: true },
  transcript: [],
};

describe('voice memory loading policy', () => {
  it('uses follow-up fast path for deepen actions', () => {
    const result = shouldUseFollowUpMemoryFastPath({
      taskType: 'interview_next_turn',
      session: voiceSession,
      latestEvaluation: {
        suggestedNextMode: 'deepen',
        closeCurrentIntent: false,
      },
      latestAnswerUnderstanding: {
        missingEvidence: ['validation_method'],
        followUpValue: 'high',
      },
    });

    expect(result).toBe(true);
  });

  it('uses follow-up fast path for probe actions', () => {
    const result = shouldUseFollowUpMemoryFastPath({
      taskType: 'interview_next_turn',
      session: voiceSession,
      latestEvaluation: {
        suggestedNextMode: 'probe',
        closeCurrentIntent: false,
      },
      latestAnswerUnderstanding: {
        missingEvidence: ['personal_ownership'],
        followUpValue: 'high',
      },
    });

    expect(result).toBe(true);
  });

  it('uses follow-up fast path for rephrase caused by misunderstanding', () => {
    const result = shouldUseFollowUpMemoryFastPath({
      taskType: 'interview_next_turn',
      session: voiceSession,
      latestEvaluation: {
        suggestedNextMode: 'rephrase',
        misunderstandingFlag: true,
        closeCurrentIntent: false,
      },
    });

    expect(result).toBe(true);
  });

  it('does not use fast path when the current topic should close and advance', () => {
    const result = shouldUseFollowUpMemoryFastPath({
      taskType: 'interview_next_turn',
      session: voiceSession,
      latestEvaluation: {
        suggestedNextMode: 'advance',
        closeCurrentIntent: true,
      },
      latestAnswerUnderstanding: {
        missingEvidence: [],
        followUpValue: 'low',
      },
    });

    expect(result).toBe(false);
  });

  it('does not use fast path for shift section or fresh question modes', () => {
    for (const mode of ['shift_section', 'switch_topic', 'fresh_question']) {
      const result = shouldUseFollowUpMemoryFastPath({
        taskType: 'interview_next_turn',
        session: voiceSession,
        latestEvaluation: {
          suggestedNextMode: mode,
          closeCurrentIntent: false,
        },
      });

      expect(result).toBe(false);
    }
  });

  it('respects explicit full memory policy override', () => {
    const result = shouldUseFollowUpMemoryFastPath({
      taskType: 'interview_next_turn',
      session: voiceSession,
      requestedPolicy: 'full',
      latestEvaluation: {
        suggestedNextMode: 'probe',
        closeCurrentIntent: false,
      },
    });

    expect(result).toBe(false);
  });

  it('respects explicit follow-up fast policy override', () => {
    const result = shouldUseFollowUpMemoryFastPath({
      taskType: 'interview_next_turn',
      session: voiceSession,
      requestedPolicy: 'follow_up_fast',
      latestEvaluation: {
        suggestedNextMode: 'advance',
        closeCurrentIntent: true,
      },
    });

    expect(result).toBe(true);
  });
});
