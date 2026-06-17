import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const callDeepSeekJsonMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/agenticSafeguards/deepseekJsonClient.js', () => ({
  callDeepSeekJson: callDeepSeekJsonMock,
}));

const previousEnv = { ...process.env };

const importFreshAgents = async () => {
  vi.resetModules();
  const [{ reviewJdParseWithDeepSeek }, { buildJdReparseOverridesWithDeepSeek }] = await Promise.all([
    import('../../../src/services/jobDescription/jdParseCriticAgent.js'),
    import('../../../src/services/jobDescription/jdParseReparseAgent.js'),
  ]);
  return { reviewJdParseWithDeepSeek, buildJdReparseOverridesWithDeepSeek };
};

describe('JD safeguard AI budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...previousEnv };
    process.env.AI_TEST_MODE = 'real';
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.JD_SAFEGUARD_AI_TIMEOUT_MS = '1234';
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...previousEnv };
  });

  it('uses a bounded no-retry critic call and marks timeout fallback metadata', async () => {
    callDeepSeekJsonMock.mockImplementationOnce(async ({ fallback }) => ({
      ...fallback,
      error: 'The operation was aborted due to timeout.',
    }));
    const { reviewJdParseWithDeepSeek } = await importFreshAgents();

    const review = await reviewJdParseWithDeepSeek({
      rawJD: 'About the role\nBuild AI tools with Python and JavaScript.',
      parsedJD: { title: 'AI Integration Engineer', sections: {} },
    });

    expect(callDeepSeekJsonMock).toHaveBeenCalledWith(expect.objectContaining({
      maxRetries: 0,
      timeoutMs: 1234,
      usageMetadata: { stage: 'jd_parse', feature: 'jd_parse_critic' },
    }));
    expect(review.providerFallbackUsed).toBe(true);
    expect(review.providerTimedOut).toBe(true);
    expect(review.providerTimeoutMs).toBe(1234);
    expect(review.providerError).toMatch(/timeout/i);
  });

  it('marks reparse provider fallback metadata without discarding heuristic overrides', async () => {
    callDeepSeekJsonMock.mockImplementationOnce(async ({ fallback }) => ({
      ...fallback,
      error: 'fetch failed',
    }));
    const { buildJdReparseOverridesWithDeepSeek } = await importFreshAgents();

    const overrides = await buildJdReparseOverridesWithDeepSeek({
      rawJD: `What you'll do
Build AI-powered tools.

Skills & Experience
Comfortable writing Python and JavaScript.`,
      previousParsedJD: { title: 'AI Integration Engineer' },
      criticFeedback: { verdict: 'revise' },
    });

    expect(callDeepSeekJsonMock).toHaveBeenCalledWith(expect.objectContaining({
      maxRetries: 0,
      timeoutMs: 1234,
      usageMetadata: { stage: 'jd_parse', feature: 'jd_reparse' },
    }));
    expect(overrides.sections.responsibilities).toContain('Build AI-powered tools.');
    expect(overrides.metadata.providerFallbackUsed).toBe(true);
    expect(overrides.metadata.providerTimedOut).toBe(false);
    expect(overrides.metadata.providerError).toBe('fetch failed');
  });
});
