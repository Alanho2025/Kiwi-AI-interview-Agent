import { describe, expect, it } from 'vitest';
import {
  getResolvedTotalQuestions,
  hasReachedTimeLimit,
  getNextQuestionOrder,
} from '../../src/services/interviewStateService.js';

describe('interviewStateService robustness & semantic fixes', () => {
  describe('getResolvedTotalQuestions', () => {
    it('respects explicit user setting for questionLimit (e.g. 8) over larger blueprint defaults', () => {
      const session = {
        settings: { questionLimit: 8 },
        interviewPlan: { questionPool: new Array(15).fill({ text: 'sample question' }) },
      };
      expect(getResolvedTotalQuestions(session)).toBe(8);
    });

    it('falls back to blueprint/resolved limits when user setting is omitted', () => {
      const session = {
        settings: {},
        interviewPlan: { questionPool: new Array(12).fill({ text: 'sample question' }) },
      };
      expect(getResolvedTotalQuestions(session)).toBe(8);
    });
  });

  describe('hasReachedTimeLimit', () => {
    it('triggers time limit wrap up once at least 1 real user turn has been completed', () => {
      const session = {
        status: 'in_progress',
        settings: { controlMode: 'time_limited', timeLimitSeconds: 900 },
        elapsedSeconds: 950,
        transcript: [
          { role: 'ai', text: 'Hi, introduce yourself' },
          { role: 'user', text: 'I am a software engineer with 3 years experience' },
        ],
      };
      expect(hasReachedTimeLimit(session)).toBe(true);
    });

    it('does not trigger time limit wrap up before any user answer has been submitted', () => {
      const session = {
        status: 'in_progress',
        settings: { controlMode: 'time_limited', timeLimitSeconds: 900 },
        elapsedSeconds: 950,
        transcript: [
          { role: 'ai', text: 'Hi, introduce yourself' },
        ],
      };
      expect(hasReachedTimeLimit(session)).toBe(false);
    });
  });

  describe('getNextQuestionOrder', () => {
    it('returns 1 for the opening question before any user answers have been submitted', () => {
      const session = {
        currentQuestionIndex: 1,
        transcript: [],
      };
      expect(getNextQuestionOrder(session)).toBe(1);
    });

    it('returns 2 after the first countable question turn has been completed', () => {
      const session = {
        currentQuestionIndex: 1,
        transcript: [
          { role: 'ai', text: 'Tell me about a project', metadata: { countsAsQuestion: true, turnType: 'interview_question' } },
        ],
      };
      expect(getNextQuestionOrder(session)).toBe(2);
    });
  });
});
