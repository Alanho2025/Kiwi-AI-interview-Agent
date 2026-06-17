import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const callDeepSeekMock = vi.hoisted(() => vi.fn());
const autoRecordUsageMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/deepseekService.js', () => ({
  callDeepSeek: callDeepSeekMock,
  autoRecordUsage: autoRecordUsageMock,
  LLM_CONFIGS: {
    JSON_STRICT: { temperature: 0, top_p: 1 },
  },
}));

const importFreshClient = async () => {
  vi.resetModules();
  return import('../../../src/services/agenticSafeguards/deepseekJsonClient.js');
};

describe('DeepSeek JSON client timeout forwarding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    callDeepSeekMock.mockResolvedValue({
      content: '{"verdict":"pass"}',
      usage: { promptTokens: 1, completionTokens: 1 },
    });
    autoRecordUsageMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('passes per-call timeoutMs to the underlying DeepSeek call', async () => {
    const { callDeepSeekJson } = await importFreshClient();

    const result = await callDeepSeekJson({
      prompt: 'Return JSON',
      timeoutMs: 4321,
      usageMetadata: { stage: 'jd_parse', feature: 'jd_parse_critic' },
    });

    expect(result).toEqual({ verdict: 'pass' });
    expect(callDeepSeekMock).toHaveBeenCalledWith(
      'Return JSON',
      'Return valid JSON only. No prose.',
      expect.objectContaining({
        timeoutMs: 4321,
        usageMetadata: {
          operation: 'llm_json',
          stage: 'jd_parse',
          feature: 'jd_parse_critic',
        },
      }),
    );
  });
});
