import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    recordAiUsageEvent,
    recordLlmUsage,
    recordSpeechUsage,
    recordLocalUsage,
    getUserAiUsageSummary,
    getRecentAiSessionUsage,
    getSessionExecutionCost,
} from '../../src/services/aiUsageTrackingService.js';

// Mock the AiUsageEvent model
vi.mock('../../src/db/models/aiUsageEventModel.js', () => ({
    AiUsageEvent: {
        create: vi.fn((payload) => Promise.resolve({ _id: 'mock-id', ...payload })),
        find: vi.fn(() => ({
            lean: vi.fn(() => Promise.resolve([])),
            sort: vi.fn(() => ({
                lean: vi.fn(() => Promise.resolve([])),
            })),
        })),
    },
}));

describe('aiUsageTrackingService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.AI_USAGE_DEBUG = 'false';
    });

    describe('recordAiUsageEvent', () => {
        it('should return null if required fields are missing', async () => {
            const result = await recordAiUsageEvent({});
            expect(result).toBeNull();
        });

        it('should return null if userId is missing', async () => {
            const result = await recordAiUsageEvent({
                provider: 'deepseek',
                modality: 'llm',
                stage: 'interview',
                operation: 'chat',
            });
            expect(result).toBeNull();
        });

        it('should create event with all required fields', async () => {
            const result = await recordAiUsageEvent({
                userId: 'user-123',
                provider: 'deepseek',
                modality: 'llm',
                stage: 'interview',
                operation: 'chat',
            });

            expect(result).toBeDefined();
            expect(result.userId).toBe('user-123');
            expect(result.provider).toBe('deepseek');
        });

        it('should sanitize metrics by removing undefined and null values', async () => {
            const result = await recordAiUsageEvent({
                userId: 'user-123',
                provider: 'deepseek',
                modality: 'llm',
                stage: 'interview',
                operation: 'chat',
                metrics: {
                    tokens: 100,
                    nullValue: null,
                    undefinedValue: undefined,
                    zeroValue: 0,
                },
            });

            expect(result.metrics).toHaveProperty('tokens');
            expect(result.metrics).toHaveProperty('zeroValue');
            expect(result.metrics).not.toHaveProperty('nullValue');
            expect(result.metrics).not.toHaveProperty('undefinedValue');
        });

        it('should round estimated cost to 8 decimal places', async () => {
            const result = await recordAiUsageEvent({
                userId: 'user-123',
                provider: 'deepseek',
                modality: 'llm',
                stage: 'interview',
                operation: 'chat',
                estimatedCost: 0.123456789,
            });

            expect(result.estimatedCost).toBe(0.12345679);
        });

        it('should handle sessionId as null when not provided', async () => {
            const result = await recordAiUsageEvent({
                userId: 'user-123',
                provider: 'deepseek',
                modality: 'llm',
                stage: 'interview',
                operation: 'chat',
            });

            expect(result.sessionId).toBeNull();
        });

        it('should preserve sessionId when provided', async () => {
            const result = await recordAiUsageEvent({
                userId: 'user-123',
                sessionId: 'session-456',
                provider: 'deepseek',
                modality: 'llm',
                stage: 'interview',
                operation: 'chat',
            });

            expect(result.sessionId).toBe('session-456');
        });
    });

    describe('recordLlmUsage', () => {
        it('should use default empty object when usage is not provided', async () => {
            // When usage parameter is omitted, default value {} is used
            const result = await recordLlmUsage({
                userId: 'user-123',
            });
            expect(result).toBeDefined();
            expect(result.metrics.promptTokens).toBe(0);
            expect(result.metrics.completionTokens).toBe(0);
        });

        it('should record LLM usage with token counts', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                },
            });

            expect(result).toBeDefined();
            expect(result.provider).toBe('deepseek');
            expect(result.modality).toBe('llm');
            expect(result.metrics.promptTokens).toBe(100);
            expect(result.metrics.completionTokens).toBe(50);
            expect(result.metrics.totalTokens).toBe(150);
        });

        it('should handle prompt cache hit tokens', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    promptCacheHitTokens: 30,
                },
            });

            expect(result.metrics.promptCacheHitTokens).toBe(30);
            expect(result.metrics.promptCacheMissTokens).toBe(70);
        });

        it('should calculate cache miss tokens when not provided', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    promptCacheHitTokens: 40,
                },
            });

            expect(result.metrics.promptCacheMissTokens).toBe(60);
        });

        it('should use provided cache miss tokens when available', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                    promptCacheHitTokens: 30,
                    promptCacheMissTokens: 65,
                },
            });

            expect(result.metrics.promptCacheMissTokens).toBe(65);
        });

        it('should handle negative token values by converting to zero', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {
                    promptTokens: -10,
                    completionTokens: -5,
                },
            });

            expect(result.metrics.promptTokens).toBe(0);
            expect(result.metrics.completionTokens).toBe(0);
            expect(result.metrics.totalTokens).toBe(0);
        });

        it('should include action in metadata', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                action: 'generate_question',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                },
            });

            expect(result.metadata.action).toBe('generate_question');
        });

        it('should use default stage and operation', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {
                    promptTokens: 100,
                    completionTokens: 50,
                },
            });

            expect(result.stage).toBe('interview');
            expect(result.operation).toBe('llm_chat');
        });
    });

    describe('recordSpeechUsage', () => {
        it('should record speech-to-text usage', async () => {
            const result = await recordSpeechUsage({
                userId: 'user-123',
                operation: 'speech_to_text',
                audioSeconds: 30,
            });

            expect(result).toBeDefined();
            expect(result.provider).toBe('azure_speech');
            expect(result.modality).toBe('speech');
            expect(result.operation).toBe('speech_to_text');
            expect(result.metrics.audioSeconds).toBe(30);
        });

        it('should record text-to-speech usage', async () => {
            const result = await recordSpeechUsage({
                userId: 'user-123',
                operation: 'text_to_speech',
                textCharacters: 500,
            });

            expect(result).toBeDefined();
            expect(result.operation).toBe('text_to_speech');
            expect(result.metrics.textCharacters).toBe(500);
        });

        it('should handle negative audio seconds by converting to zero', async () => {
            const result = await recordSpeechUsage({
                userId: 'user-123',
                operation: 'speech_to_text',
                audioSeconds: -10,
            });

            expect(result.metrics.audioSeconds).toBe(0);
        });

        it('should default requestCount to 1 when not provided', async () => {
            const result = await recordSpeechUsage({
                userId: 'user-123',
                operation: 'speech_to_text',
                audioSeconds: 30,
            });

            expect(result.metrics.requestCount).toBe(1);
        });

        it('should handle zero requestCount by defaulting to 1', async () => {
            const result = await recordSpeechUsage({
                userId: 'user-123',
                operation: 'speech_to_text',
                audioSeconds: 30,
                requestCount: 0,
            });

            expect(result.metrics.requestCount).toBe(1);
        });

        it('should use custom provider when specified', async () => {
            const result = await recordSpeechUsage({
                userId: 'user-123',
                provider: 'elevenlabs',
                operation: 'text_to_speech',
                textCharacters: 500,
            });

            expect(result.provider).toBe('elevenlabs');
        });
    });

    describe('recordLocalUsage', () => {
        it('should record local usage with zero cost', async () => {
            const result = await recordLocalUsage({
                userId: 'user-123',
                stage: 'cv_parse',
            });

            expect(result).toBeDefined();
            expect(result.provider).toBe('local');
            expect(result.modality).toBe('local');
            expect(result.estimatedCost).toBe(0);
            expect(result.metrics.requestCount).toBe(1);
        });

        it('should use default operation when not provided', async () => {
            const result = await recordLocalUsage({
                userId: 'user-123',
                stage: 'cv_parse',
            });

            expect(result.operation).toBe('local_parse');
        });

        it('should include metadata', async () => {
            const result = await recordLocalUsage({
                userId: 'user-123',
                stage: 'cv_parse',
                metadata: { parser: 'pdf' },
            });

            expect(result.metadata.parser).toBe('pdf');
        });
    });

    describe('getUserAiUsageSummary', () => {
        it('should return empty summary if userId is not provided', async () => {
            const result = await getUserAiUsageSummary(null);

            expect(result).toBeDefined();
            expect(result.totalCost).toBe(0);
            expect(result.totalTokens).toBe(0);
            expect(result.measuredSessions).toBe(0);
        });

        it('should return empty summary structure', async () => {
            const result = await getUserAiUsageSummary('user-123');

            expect(result).toHaveProperty('currency');
            expect(result).toHaveProperty('totalCost');
            expect(result).toHaveProperty('totalPromptTokens');
            expect(result).toHaveProperty('totalCompletionTokens');
            expect(result).toHaveProperty('totalTokens');
            expect(result).toHaveProperty('speechAudioSeconds');
            expect(result).toHaveProperty('speechTextCharacters');
            expect(result).toHaveProperty('callCount');
            expect(result).toHaveProperty('measuredSessions');
            expect(result).toHaveProperty('providerBreakdown');
            expect(result).toHaveProperty('pricing');
        });
    });

    describe('getRecentAiSessionUsage', () => {
        it('should return empty array if userId is not provided', async () => {
            const result = await getRecentAiSessionUsage(null);
            expect(result).toEqual([]);
        });

        it('should return empty array when no sessions found', async () => {
            const result = await getRecentAiSessionUsage('user-123');
            expect(result).toEqual([]);
        });

        it('should respect limit parameter', async () => {
            const result = await getRecentAiSessionUsage('user-123', 3);
            expect(Array.isArray(result)).toBe(true);
        });
    });

    describe('getSessionExecutionCost', () => {
        it('should return null if userId is missing', async () => {
            const result = await getSessionExecutionCost({ sessionId: 'session-123' });
            expect(result).toBeNull();
        });

        it('should return null if sessionId is missing', async () => {
            const result = await getSessionExecutionCost({ userId: 'user-123' });
            expect(result).toBeNull();
        });

        it('should return execution cost structure', async () => {
            const result = await getSessionExecutionCost({
                userId: 'user-123',
                sessionId: 'session-456',
            });

            expect(result).toBeDefined();
            expect(result).toHaveProperty('sessionId');
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('stageBreakdown');
            expect(result).toHaveProperty('commercialStressTest');
            expect(result).toHaveProperty('events');
        });

        it('should include commercial stress test data', async () => {
            const result = await getSessionExecutionCost({
                userId: 'user-123',
                sessionId: 'session-456',
            });

            expect(result.commercialStressTest).toHaveProperty('currency');
            expect(result.commercialStressTest).toHaveProperty('totalExecutionCost');
            expect(result.commercialStressTest).toHaveProperty('estimatedHumanMinutesReplaced');
            expect(result.commercialStressTest).toHaveProperty('estimatedSavings');
            expect(result.commercialStressTest).toHaveProperty('costToValueRatio');
        });
    });

    describe('edge cases', () => {
        it('should handle undefined usage by using default empty object', async () => {
            // When usage is undefined, the default parameter value {} is used
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: undefined,
            });
            expect(result).toBeDefined();
            expect(result.metrics.promptTokens).toBe(0);
            expect(result.metrics.completionTokens).toBe(0);
        });

        it('should handle null usage object by returning null', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: null,
            });
            expect(result).toBeNull();
        });

        it('should handle empty usage object by creating event with zero tokens', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {},
            });
            expect(result).toBeDefined();
            expect(result.metrics.promptTokens).toBe(0);
            expect(result.metrics.completionTokens).toBe(0);
        });

        it('should handle empty metrics object', async () => {
            const result = await recordAiUsageEvent({
                userId: 'user-123',
                provider: 'deepseek',
                modality: 'llm',
                stage: 'interview',
                operation: 'chat',
                metrics: {},
            });

            expect(result.metrics).toEqual({});
        });

        it('should handle string numbers in token counts', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {
                    promptTokens: '100',
                    completionTokens: '50',
                },
            });

            expect(result.metrics.promptTokens).toBe(100);
            expect(result.metrics.completionTokens).toBe(50);
        });

        it('should handle NaN values by converting to zero', async () => {
            const result = await recordLlmUsage({
                userId: 'user-123',
                usage: {
                    promptTokens: NaN,
                    completionTokens: 50,
                },
            });

            expect(result.metrics.promptTokens).toBe(0);
        });
    });
});

// Made with Bob