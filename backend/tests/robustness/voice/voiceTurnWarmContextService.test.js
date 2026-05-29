import { afterAll, beforeEach, describe, expect, it } from 'vitest';

import warmContextService from '../../../src/services/voice/voiceTurnWarmContextService.js';

describe('voice turn warm context cache', () => {
  beforeEach(() => {
    warmContextService.clearAll();
  });

  afterAll(() => {
    warmContextService.clearAll();
    warmContextService.stopCleanupTimer();
  });

  it('uses a compatible warm context when the frontend turn id sequence differs', async () => {
    const now = Date.now();
    const cacheKey = warmContextService.buildCacheKey({
      sessionId: 'session-1',
      questionId: 'question-2',
      clientTurnId: 'voice-turn-1-1-next',
    });
    warmContextService.cache.set(cacheKey, {
      sessionId: 'session-1',
      questionId: 'question-2',
      clientTurnId: 'voice-turn-1-1-next',
      currentQuestionIndex: 2,
      retrievalBundle: { chunks: ['retrieved'] },
      baseEnvironment: { latestAnswer: { text: 'cached' } },
      evidenceBundle: { evidence: ['cached'] },
      createdAt: now - 1000,
      expiresAt: now + 30000,
      preparationDurationMs: 250,
    });

    const warmContext = await warmContextService.getWarmContext({
      sessionId: 'session-1',
      questionId: 'question-2',
      clientTurnId: 'voice-turn-1-2',
      currentQuestionIndex: 2,
      sessionStatus: 'in_progress',
    });

    expect(warmContext).toEqual(expect.objectContaining({
      retrievalBundle: { chunks: ['retrieved'] },
      baseEnvironment: { latestAnswer: { text: 'cached' } },
      evidenceBundle: { evidence: ['cached'] },
    }));
    expect(warmContext.metadata).toEqual(expect.objectContaining({
      cacheClientTurnId: 'voice-turn-1-1-next',
      requestedClientTurnId: 'voice-turn-1-2',
      matchMode: 'question_index_fallback',
    }));
  });

  it('does not reuse warm context across different questions', async () => {
    const now = Date.now();
    warmContextService.cache.set('session-1:question-1:any-turn', {
      sessionId: 'session-1',
      questionId: 'question-1',
      clientTurnId: 'any-turn',
      currentQuestionIndex: 1,
      retrievalBundle: {},
      baseEnvironment: {},
      evidenceBundle: {},
      createdAt: now - 1000,
      expiresAt: now + 30000,
      preparationDurationMs: 100,
    });

    const warmContext = await warmContextService.getWarmContext({
      sessionId: 'session-1',
      questionId: 'question-2',
      clientTurnId: 'voice-turn-1-2',
      currentQuestionIndex: 2,
      sessionStatus: 'in_progress',
    });

    expect(warmContext).toBeNull();
  });
});
