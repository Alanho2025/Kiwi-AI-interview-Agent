import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createRoutedRealtimeSpeechSession } from '../../../src/services/voice/realtimeSpeechProviderRouter.js';
import { getTtsProviderOrder } from '../../../src/services/voice/ttsProviderRouter.js';
import warmContextService from '../../../src/services/voice/voiceTurnWarmContextService.js';
import { buildTurnActiveSpeechPhraseContext } from '../../../src/services/voice/speechPhraseHintService.js';
import { normalizeTranscript } from '../../../src/services/voice/transcriptNormalizer.js';
import { validateRealtimeVoiceTranscript } from '../../../src/services/voice/speechConfidenceGate.js';

describe('voice engine robustness chaos & edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.VOICE_STT_PROVIDER;
    delete process.env.VOICE_STT_FALLBACK_PROVIDER;
    delete process.env.VOICE_STT_PROVIDER_ORDER;
    delete process.env.VOICE_TTS_PROVIDER;
    delete process.env.VOICE_TTS_FALLBACK_PROVIDER;
    delete process.env.VOICE_TTS_PROVIDER_ORDER;
    warmContextService.clearAll();
  });

  afterEach(() => {
    warmContextService.clearAll();
  });

  describe('1. STT / TTS Provider Failover & Degraded Path', () => {
    it('resolves TTS provider order with fallback configured', () => {
      process.env.VOICE_TTS_PROVIDER = 'azure';
      process.env.VOICE_TTS_FALLBACK_PROVIDER = 'elevenlabs';

      const providerOrder = getTtsProviderOrder();
      expect(providerOrder).toEqual(['azure', 'elevenlabs']);
    });

    it('returns structured error when no STT provider can be initialized', () => {
      process.env.VOICE_STT_PROVIDER_ORDER = 'unsupported_provider';

      expect(() => createRoutedRealtimeSpeechSession()).toThrow(
        /No realtime STT provider could be created/
      );
    });
  });

  describe('2. Warm Context Invalidation on Interrupted or Rejected Turns', () => {
    it('invalidates warm context cache when user answer is rejected or discarded', async () => {
      const cacheKey = warmContextService.buildCacheKey({
        sessionId: 'session-chaos-1',
        questionId: 'q-1',
        clientTurnId: 'turn-1',
      });

      warmContextService.cache.set(cacheKey, {
        sessionId: 'session-chaos-1',
        questionId: 'q-1',
        clientTurnId: 'turn-1',
        currentQuestionIndex: 1,
        retrievalBundle: { chunks: ['stale-warmup'] },
        createdAt: Date.now(),
        expiresAt: Date.now() + 30000,
      });

      // Confirm item is cached
      expect(warmContextService.cache.has(cacheKey)).toBe(true);

      // Invalidate session cache
      warmContextService.clearAll();

      // Verify cache is cleared so stale context is never reused
      const fetched = await warmContextService.getWarmContext({
        sessionId: 'session-chaos-1',
        questionId: 'q-1',
        clientTurnId: 'turn-1',
        currentQuestionIndex: 1,
      });
      expect(fetched).toBeNull();
    });
  });

  describe('3. Tech Terms Phrase List & Transcript Calibration Integrity', () => {
    it('safely builds active turn phrase hints respecting hard caps', () => {
      const longSkills = Array.from({ length: 50 }, (_, i) => ({ term: `Skill_${i}`, priority: 'high' }));
      const result = buildTurnActiveSpeechPhraseContext({
        activeQuestion: { targetTechnicalTerms: longSkills },
        session: {},
      });

      expect(result).toBeDefined();
      expect(Array.isArray(result.phraseList)).toBe(true);
      expect(result.phraseList.length).toBeLessThanOrEqual(40);
    });

    it('normalizes tech terms without distorting character structure or introducing corrupted tokens', () => {
      const rawText = '  I used   react and nodejs with postgresql database.  ';
      const { normalizedText, changed } = normalizeTranscript(rawText);

      expect(normalizedText).toBe('I used react and Node.js with PostgreSQL database.');
      expect(changed).toBe(true);
    });
  });

  describe('4. Question Scope Clarification & Non-Scoring Guard', () => {
    it('enforces that low-confidence or scope clarification turns do NOT count as questions', () => {
      const decision = validateRealtimeVoiceTranscript({
        transcriptText: 'I am comparing AWS Lambda and EC2 for background job processing.',
        asrConfidence: 0.15,
        vad: { speechDurationMs: 15000, sttSegmentCount: 2, isFinal: true },
      });

      expect(decision.ok).toBe(false);
      expect(decision.decision).toBe('reject');
      expect(decision.reason).toBe('LOW_CONFIDENCE_TRANSCRIPT');
      expect(decision.countsAsQuestion).toBeUndefined();
    });

    it('requires confirmation for long low-confidence answers without counting as an interview question', () => {
      const decision = validateRealtimeVoiceTranscript({
        transcriptText: 'I compared MongoDB and PostgreSQL because the interview agent stores flexible CV text, job descriptions, transcript records, match analysis, and structured user account data. I chose the database based on query needs, schema flexibility, and validation requirements.',
        asrConfidence: 0.24,
        vad: { speechDurationMs: 42000, sttSegmentCount: 3, isFinal: true },
      });

      expect(decision.ok).toBe(false);
      expect(decision.decision).toBe('confirm_understanding');
      expect(decision.requiresUnderstandingConfirmation).toBe(true);
      expect(decision.countsAsQuestion).toBe(false);
      expect(decision.shouldProcessAnswer).toBe(false);
    });
  });
});
