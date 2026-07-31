import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import warmContextService from '../../../src/services/voice/voiceTurnWarmContextService.js';

describe('5. warmContextInvalidation: Warm context cache invalidation on rejected turns', () => {
  beforeEach(() => {
    warmContextService.clearAll();
  });

  afterEach(() => {
    warmContextService.clearAll();
  });

  it('invalidates session-specific warm context using clearWarmContext', async () => {
    const cacheKey = warmContextService.buildCacheKey({
      sessionId: 'session-target-1',
      questionId: 'q-1',
      clientTurnId: 'turn-1',
    });

    warmContextService.cache.set(cacheKey, {
      sessionId: 'session-target-1',
      questionId: 'q-1',
      clientTurnId: 'turn-1',
      currentQuestionIndex: 1,
      retrievalBundle: { chunks: ['warmup'] },
      createdAt: Date.now(),
      expiresAt: Date.now() + 30000,
    });

    // Also populate a second session
    warmContextService.cache.set('session-other:q-1:turn-1', {
      sessionId: 'session-other',
      questionId: 'q-1',
      clientTurnId: 'turn-1',
      currentQuestionIndex: 1,
      retrievalBundle: {},
      createdAt: Date.now(),
      expiresAt: Date.now() + 30000,
    });

    expect(warmContextService.cache.has(cacheKey)).toBe(true);

    // Call service method clearWarmContext for session-target-1
    await warmContextService.clearWarmContext({ sessionId: 'session-target-1' });

    // Target session cleared, other session preserved
    expect(warmContextService.cache.has(cacheKey)).toBe(false);
    expect(warmContextService.cache.has('session-other:q-1:turn-1')).toBe(true);
  });

  it('rejects cached context automatically when current question ID or index changes', async () => {
    const cacheKey = warmContextService.buildCacheKey({
      sessionId: 'session-mismatch-1',
      questionId: 'q-original',
      clientTurnId: 'turn-1',
    });

    warmContextService.cache.set(cacheKey, {
      sessionId: 'session-mismatch-1',
      questionId: 'q-original',
      clientTurnId: 'turn-1',
      currentQuestionIndex: 1,
      retrievalBundle: { chunks: ['original'] },
      createdAt: Date.now(),
      expiresAt: Date.now() + 30000,
    });

    // Request with mismatched questionId (e.g. after question switch / repair)
    const result = await warmContextService.getWarmContext({
      sessionId: 'session-mismatch-1',
      questionId: 'q-new-question',
      clientTurnId: 'turn-1',
      currentQuestionIndex: 2,
    });

    expect(result).toBeNull();
  });
});
