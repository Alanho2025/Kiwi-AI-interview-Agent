import { describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  find: vi.fn(),
}));

vi.mock('../../../src/db/models/aiUsageEventModel.js', () => ({
  AiUsageEvent: {
    find: modelMocks.find,
  },
}));

describe('cost accounting robustness', () => {
  it('keeps session commercial-stress totals consistent with recorded usage events', async () => {
    const expectedTotalCostNzd = 0.000594;
    const events = [
      {
        userId: 'user-1',
        sessionId: 'session-1',
        provider: 'deepseek',
        modality: 'llm',
        stage: 'interview',
        operation: 'llm_chat',
        metrics: { promptTokens: 100, completionTokens: 50, totalTokens: 150, requestCount: 1 },
        estimatedCost: 0.00012,
      },
      {
        userId: 'user-1',
        sessionId: 'session-1',
        provider: 'azure_speech',
        modality: 'speech',
        stage: 'interview',
        operation: 'speech_to_text',
        metrics: { audioSeconds: 12.4, requestCount: 1 },
        estimatedCost: 0.00008,
      },
      {
        userId: 'user-1',
        sessionId: 'session-1',
        provider: 'azure_speech',
        modality: 'speech',
        stage: 'interview',
        operation: 'text_to_speech',
        metrics: { textCharacters: 320, requestCount: 1 },
        estimatedCost: 0.00016,
      },
    ];
    modelMocks.find.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue(events),
      }),
    });
    const { getSessionExecutionCost } = await import('../../../src/services/aiUsageTrackingService.js');

    const cost = await getSessionExecutionCost({ userId: 'user-1', sessionId: 'session-1' });

    expect(modelMocks.find).toHaveBeenCalledWith({ userId: 'user-1', sessionId: 'session-1' });
    expect(cost.summary.totalTokens).toBe(150);
    expect(cost.summary.speechAudioSeconds).toBe(12.4);
    expect(cost.summary.speechTextCharacters).toBe(320);
    expect(cost.summary.currency).toBe('NZD');
    expect(cost.summary.pricing.currency).toBe('NZD');
    expect(cost.summary.pricing.sourceCurrency).toBe('USD');
    expect(cost.summary.totalCost).toBe(expectedTotalCostNzd);
    expect(cost.commercialStressTest.totalExecutionCost).toBe(cost.summary.totalCost);
    expect(cost.commercialStressTest.currency).toBe('NZD');
    expect(cost.commercialStressTest.assumptions).toContain('NZ$35/hour');
    expect(cost.commercialStressTest.totalLlmTokens).toBe(cost.summary.totalTokens);
    expect(cost.commercialStressTest.speechAudioSeconds).toBe(12);
    expect(cost.commercialStressTest.speechTextCharacters).toBe(320);
    expect(cost.stageBreakdown[0].estimatedCost).toBe(cost.summary.totalCost);
    expect(cost.stageBreakdown[0].currency).toBe('NZD');

    const numericValues = [
      cost.summary.totalCost,
      cost.summary.totalTokens,
      cost.summary.speechAudioSeconds,
      cost.summary.speechTextCharacters,
      cost.commercialStressTest.totalExecutionCost,
      cost.commercialStressTest.costToValueRatio,
    ];
    expect(numericValues.every((value) => Number.isFinite(value) && value >= 0)).toBe(true);
  });
});
