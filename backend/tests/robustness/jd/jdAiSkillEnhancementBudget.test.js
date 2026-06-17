import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const callDeepSeekMock = vi.hoisted(() => vi.fn());

vi.mock('../../../src/services/deepseekService.js', () => ({
  callDeepSeek: callDeepSeekMock,
}));

vi.mock('../../../src/services/pythonNlpService.js', () => ({
  analyzeTextWithSpacy: vi.fn(async () => null),
}));

const previousEnv = { ...process.env };

const importFreshAiService = async () => {
  vi.resetModules();
  return import('../../../src/services/jobDescription/jobDescriptionAiService.js');
};

const importFreshRubricBuilder = async () => {
  vi.resetModules();
  return import('../../../src/services/jobDescription/jobDescriptionRubricBuilder.js');
};

describe('JD AI skill enhancement budget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...previousEnv };
    process.env.DEEPSEEK_API_KEY = 'test-key';
    process.env.JD_AI_SKILL_ENHANCEMENT_TIMEOUT_MS = '2345';
    delete process.env.DISABLE_AI_JD_ENHANCEMENT;
    callDeepSeekMock.mockResolvedValue({
      content: JSON.stringify({
        technicalSkills: ['Python'],
        softSkills: ['communication'],
        macroCriteria: ['delivery'],
        requirements: ['Build tools'],
      }),
      usage: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env = { ...previousEnv };
  });

  it('uses a bounded timeout for foreground JD AI skill enhancement', async () => {
    const { extractSkillsWithAI } = await importFreshAiService();

    const result = await extractSkillsWithAI('Build tools with Python.');

    expect(result.technicalSkillRequirements).toContain('Python');
    expect(callDeepSeekMock).toHaveBeenCalledWith(
      expect.any(String),
      'Return valid JSON only. No prose.',
      expect.objectContaining({
        timeoutMs: 2345,
        usageMetadata: { stage: 'jd_parse', operation: 'llm_chat', feature: 'jd_skill_extraction' },
      }),
    );
  });

  it('skips duplicate AI skill enhancement when rubric builder is in reparse mode', async () => {
    const { buildStructuredJobDescriptionRubric } = await importFreshRubricBuilder();

    const rubric = await buildStructuredJobDescriptionRubric('About the role\nBuild tools with Python.', {
      reparseMode: true,
      skipAiSkillEnhancement: true,
    });

    expect(rubric.sections.responsibilities).toContain('Build tools with Python.');
    expect(callDeepSeekMock).not.toHaveBeenCalled();
  });
});
