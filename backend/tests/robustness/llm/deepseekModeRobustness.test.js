import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const importFreshService = async () => {
  vi.resetModules();
  return import('../../../src/services/deepseekService.js');
};

describe('DeepSeek mode robustness', () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...previousEnv };
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.AI_TEST_MODE;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...previousEnv };
  });

  it('uses deterministic mock output silently when AI_TEST_MODE=mock', async () => {
    process.env.AI_TEST_MODE = 'mock';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { callDeepSeek } = await importFreshService();

    const response = await callDeepSeek('parse this CV');

    expect(response.content).toMatch(/mock response/i);
    expect(response.usage).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('fails fast when real AI eval is requested without a DeepSeek key', async () => {
    process.env.AI_TEST_MODE = 'real';
    const { callDeepSeek } = await importFreshService();

    await expect(callDeepSeek('parse this JD')).rejects.toThrow(/DEEPSEEK_API_KEY is required/i);
  });

  it('surfaces non-OK DeepSeek responses during real eval instead of silently passing', async () => {
    process.env.AI_TEST_MODE = 'real';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, statusText: 'Too Many Requests' })));
    const { callDeepSeek } = await importFreshService();

    await expect(callDeepSeek('parse this JD')).rejects.toThrow(/Too Many Requests/i);
  });
});
