import { describe, expect, it } from 'vitest';
import {
  AI_USAGE_ROLLUP_SOURCE,
  TOKEN_USAGE_ROLLUP_SOURCE,
  buildAiUsageDailyRollup,
  buildUsageRollupBackfillPlan,
  buildTokenUsageDailyRollup,
  combineUsageRollups,
  shouldReplaceUsageRollup,
  verifyUsageRollupBackfill,
} from '../../src/services/usageRollupService.js';

describe('usageRollupService', () => {
  it('builds an auditable daily AI rollup with source IDs and distinct sessions', () => {
    const rollup = buildAiUsageDailyRollup([
      {
        _id: 'event-1', userId: 'user-1', sessionId: 'session-1', provider: 'deepseek',
        estimatedCost: 0.1, metrics: { promptTokens: 10, completionTokens: 5, totalTokens: 15, requestCount: 1 },
        createdAt: new Date('2026-06-20T01:00:00Z'), updatedAt: new Date('2026-06-20T01:00:00Z'),
      },
      {
        _id: 'event-2', userId: 'user-1', sessionId: 'session-1', provider: 'azure_speech',
        estimatedCost: 0.2, metrics: { audioSeconds: 30, requestCount: 1 },
        createdAt: new Date('2026-06-20T02:00:00Z'), updatedAt: new Date('2026-06-20T02:00:00Z'),
      },
    ], { userId: 'user-1', day: new Date('2026-06-20T00:00:00Z') });

    expect(rollup.source).toBe(AI_USAGE_ROLLUP_SOURCE);
    expect(rollup.sourceEventIds).toEqual(['event-1', 'event-2']);
    expect(rollup.sourceChecksum).toMatch(/^[a-f0-9]{64}$/);
    expect(rollup.sessionIds).toEqual(['session-1']);
    expect(rollup.summary).toMatchObject({
      totalCostUsd: 0.3,
      totalPromptTokens: 10,
      totalCompletionTokens: 5,
      totalTokens: 15,
      speechAudioSeconds: 30,
      callCount: 2,
    });
  });

  it('builds token fallback rollups without double-counting AI usage', () => {
    const rollup = buildTokenUsageDailyRollup([{
      _id: 'token-1', userId: 'user-1', sessionId: 'session-2',
      promptTokens: 20, completionTokens: 10, estimatedCost: 0.4,
      createdAt: new Date('2026-06-20T03:00:00Z'), updatedAt: new Date('2026-06-20T03:00:00Z'),
    }], { userId: 'user-1', day: new Date('2026-06-20T00:00:00Z') });

    expect(rollup.source).toBe(TOKEN_USAGE_ROLLUP_SOURCE);
    expect(rollup.summary).toMatchObject({ totalPromptTokens: 20, totalCompletionTokens: 10, totalTokens: 30 });
  });

  it('combines daily rollups into lifetime totals with globally distinct sessions', () => {
    const combined = combineUsageRollups([
      {
        summary: { totalCostUsd: 1, totalTokens: 10, callCount: 1 },
        sessionIds: ['shared-session'],
        providerTotals: [{ provider: 'deepseek', totalCostUsd: 1, totalTokens: 10, requestCount: 1 }],
      },
      {
        summary: { totalCostUsd: 2, totalTokens: 20, callCount: 2 },
        sessionIds: ['shared-session', 'another-session'],
        providerTotals: [{ provider: 'deepseek', totalCostUsd: 2, totalTokens: 20, requestCount: 2 }],
      },
    ]);

    expect(combined.summary).toMatchObject({ totalCostUsd: 3, totalTokens: 30, callCount: 3 });
    expect(combined.measuredSessions).toBe(2);
    expect(combined.providerTotals).toEqual([
      expect.objectContaining({ provider: 'deepseek', totalCostUsd: 3, totalTokens: 30, requestCount: 3 }),
    ]);
  });

  it('builds one deterministic rollup per source, user, and UTC day', () => {
    const plan = buildUsageRollupBackfillPlan({
      aiEvents: [
        { _id: 'a1', userId: 'u1', createdAt: new Date('2026-06-19T23:00:00Z'), metrics: {} },
        { _id: 'a2', userId: 'u1', createdAt: new Date('2026-06-20T01:00:00Z'), metrics: {} },
      ],
      tokenEvents: [
        { _id: 't1', userId: 'u1', createdAt: new Date('2026-06-20T02:00:00Z') },
      ],
    });

    expect(plan).toHaveLength(3);
    expect(plan.map((item) => `${item.source}:${item.userId}:${item.day.toISOString()}`)).toEqual([
      'ai_usage_event:u1:2026-06-19T00:00:00.000Z',
      'ai_usage_event:u1:2026-06-20T00:00:00.000Z',
      'token_usage:u1:2026-06-20T00:00:00.000Z',
    ]);
  });

  it('verifies exact source coverage and lifetime metrics before raw data can expire', () => {
    const events = [{
      _id: 'a1', userId: 'u1', sessionId: 's1', provider: 'deepseek', estimatedCost: 0.5,
      createdAt: new Date('2026-06-20T01:00:00Z'), updatedAt: new Date('2026-06-20T01:00:00Z'),
      metrics: { promptTokens: 10, completionTokens: 5, totalTokens: 15, requestCount: 1 },
    }];
    const rollup = buildAiUsageDailyRollup(events, { userId: 'u1', day: events[0].createdAt });

    expect(verifyUsageRollupBackfill({ events, rollups: [rollup], source: AI_USAGE_ROLLUP_SOURCE })).toMatchObject({
      verified: true,
      sourceEventCount: 1,
      measuredSessions: 1,
    });

    rollup.summary.totalTokens = 999;
    expect(verifyUsageRollupBackfill({ events, rollups: [rollup], source: AI_USAGE_ROLLUP_SOURCE })).toMatchObject({
      verified: false,
      metricsMatch: false,
    });
  });

  it('never lets a stale concurrent refresh replace a more complete rollup', () => {
    expect(shouldReplaceUsageRollup(
      { sourceEventCount: 2, sourceChecksum: 'newer' },
      { sourceEventCount: 1, sourceChecksum: 'stale' },
    )).toBe(false);
    expect(shouldReplaceUsageRollup(
      { sourceEventCount: 1, sourceChecksum: 'old' },
      { sourceEventCount: 1, sourceChecksum: 'corrected' },
    )).toBe(true);
  });

  it('includes provider identity in the auditable source checksum', () => {
    const event = {
      _id: 'a1', userId: 'u1', provider: 'deepseek', estimatedCost: 0.1, metrics: { requestCount: 1 },
      createdAt: new Date('2026-06-20T01:00:00Z'), updatedAt: new Date('2026-06-20T01:00:00Z'),
    };
    const original = buildAiUsageDailyRollup([event], { userId: 'u1', day: event.createdAt });
    const changed = buildAiUsageDailyRollup([{ ...event, provider: 'azure_speech' }], {
      userId: 'u1', day: event.createdAt,
    });

    expect(changed.sourceChecksum).not.toBe(original.sourceChecksum);
  });
});
