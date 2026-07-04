import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TokenUsage } from '../../src/db/models/tokenUsageModel.js';
import {
  getUsageSummary,
  recordTokenUsage,
} from '../../src/services/usageTrackingService.js';
import {
  getUserUsageRollups,
  refreshTokenUsageDailyRollup,
} from '../../src/services/usageRollupService.js';

vi.mock('../../src/db/models/tokenUsageModel.js', () => ({
  TokenUsage: {
    create: vi.fn((payload) => Promise.resolve({
      _id: 'token-event-1',
      createdAt: new Date('2026-06-20T01:00:00.000Z'),
      ...payload,
    })),
    aggregate: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock('../../src/services/usageRollupService.js', () => ({
  TOKEN_USAGE_ROLLUP_SOURCE: 'token_usage',
  combineUsageRollups: vi.fn((rollups) => ({ summary: rollups[0].summary })),
  getUserUsageRollups: vi.fn(() => Promise.resolve([])),
  refreshTokenUsageDailyRollup: vi.fn(() => Promise.resolve()),
}));

describe('usageTrackingService lifetime rollups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUserUsageRollups.mockResolvedValue([]);
  });

  it('refreshes the permanent daily rollup after recording token usage', async () => {
    await recordTokenUsage({
      userId: 'user-1',
      sessionId: 'session-1',
      action: 'chat',
      promptTokens: 10,
      completionTokens: 5,
    });

    expect(refreshTokenUsageDailyRollup).toHaveBeenCalledWith({
      userId: 'user-1',
      day: new Date('2026-06-20T01:00:00.000Z'),
    });
  });

  it('uses permanent rollups instead of expiring raw rows for lifetime totals', async () => {
    getUserUsageRollups.mockResolvedValue([{
      summary: {
        totalPromptTokens: 100,
        totalCompletionTokens: 40,
        totalTokens: 140,
        totalCostUsd: 0.12,
        callCount: 4,
      },
    }]);

    const result = await getUsageSummary('user-1');

    expect(result).toMatchObject({
      totalPromptTokens: 100,
      totalCompletionTokens: 40,
      totalTokens: 140,
      callCount: 4,
    });
    expect(TokenUsage.aggregate).not.toHaveBeenCalled();
  });

  it('falls back to raw rows until the first rollup exists', async () => {
    TokenUsage.aggregate.mockResolvedValue([{
      totalPromptTokens: 8,
      totalCompletionTokens: 2,
      totalCost: 0.01,
      callCount: 1,
    }]);

    const result = await getUsageSummary('user-1');

    expect(result.totalTokens).toBe(10);
    expect(TokenUsage.aggregate).toHaveBeenCalledOnce();
  });
});
