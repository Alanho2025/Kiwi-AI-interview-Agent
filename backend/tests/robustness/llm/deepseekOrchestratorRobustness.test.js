import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callDeepSeekJson, parseJsonSafely, repairMalformedJson } from '../../../src/services/agenticSafeguards/deepseekJsonClient.js';
import { callDeepSeek, extractUsage, LLM_CONFIGS } from '../../../src/services/deepseekService.js';

describe('Phase 1 - F-62 & F-64: DeepSeek LLM Orchestrator Production Robustness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.AI_TEST_MODE;
    delete process.env.DEEPSEEK_API_KEY;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('strips markdown fencing and repairs malformed JSON with trailing commas or unclosed braces', () => {
    const rawFenced = '```json\n{\n  "selectedAction": "ask_follow_up",\n  "confidence": 0.95,\n}\n```';
    const parsed = parseJsonSafely(rawFenced);

    expect(parsed).toEqual({
      selectedAction: 'ask_follow_up',
      confidence: 0.95,
    });

    const unclosedJson = '{"selectedAction": "topic_switch", "confidence": 0.8';
    expect(repairMalformedJson(unclosedJson)).toBe('{"selectedAction": "topic_switch", "confidence": 0.8}');
    expect(parseJsonSafely(unclosedJson)).toEqual({ selectedAction: 'topic_switch', confidence: 0.8 });
  });

  it('retries on HTTP 429 rate limits with exponential backoff before succeeding', async () => {
    process.env.DEEPSEEK_API_KEY = 'mock-test-key';

    const mockFetch = vi.spyOn(global, 'fetch')
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: new Headers({ 'retry-after': '0' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"status":"success"}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5 },
        }),
      });

    const response = await callDeepSeek('Test prompt', 'System instruction', { backoffMs: 1, maxRetries: 2 });
    expect(response.content).toBe('{"status":"success"}');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('falls back to default fallback payload when JSON parsing repeatedly fails', async () => {
    process.env.AI_TEST_MODE = 'mock';

    const fallback = { selectedAction: 'ask_fallback_question', confidence: 0.5 };
    const result = await callDeepSeekJson({
      prompt: 'Invalid JSON test',
      fallback,
      maxRetries: 1,
    });

    expect(result).toEqual(expect.objectContaining({
      selectedAction: 'ask_fallback_question',
      confidence: 0.5,
    }));
    expect(result.error).toBeDefined();
  });

  it('extracts token usage metrics including prompt cache hit/miss tokens correctly', () => {
    const apiResponse = {
      usage: {
        prompt_tokens: 150,
        completion_tokens: 45,
        prompt_cache_hit_tokens: 100,
        prompt_cache_miss_tokens: 50,
      },
    };

    const usage = extractUsage(apiResponse);
    expect(usage).toEqual({
      promptTokens: 150,
      completionTokens: 45,
      promptCacheHitTokens: 100,
      promptCacheMissTokens: 50,
    });
  });

  it('enforces JSON_STRICT configuration generation defaults for llm_json operations', () => {
    expect(LLM_CONFIGS.JSON_STRICT).toEqual({
      temperature: 0,
      top_p: 1,
    });
  });
});
