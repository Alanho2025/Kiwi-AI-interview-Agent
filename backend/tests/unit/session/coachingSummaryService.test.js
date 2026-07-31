import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateCoachingSummary } from '../../../src/services/session/progressAnalyticsService.js';

describe('coachingSummaryService (Phase C On-Demand LLM Summary)', () => {
  const userId = 'user-123-abc';
  const targetRole = 'Junior AI Integration Engineer';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns guidance when comparable sessions count is N < 2 (insufficient_data)', async () => {
    const result = await generateCoachingSummary({
      userId,
      targetRole,
      deliveryMode: 'text',
      sessions: [],
      reports: [],
    });

    expect(result.coachingStatus).toBe('insufficient_data');
    expect(result.message).toContain('At least 2 comparable sessions are required');
  });

  it('generates deterministic fallback coaching summary for N >= 2 valid sessions', async () => {
    const mockSessions = [
      { id: 'sess-1', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: null, created_at: new Date('2026-07-20T10:00:00Z') },
      { id: 'sess-2', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: null, created_at: new Date('2026-07-22T10:00:00Z') },
    ];

    const mockReports = [
      { sessionId: 'sess-1', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 60, acceptedEligibleTurns: 4, directPastCount: 2, hypotheticalCount: 2 } },
      { sessionId: 'sess-2', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 78, acceptedEligibleTurns: 4, directPastCount: 3, hypotheticalCount: 1 } },
    ];

    const result = await generateCoachingSummary({
      userId,
      targetRole,
      deliveryMode: 'text',
      sessions: mockSessions,
      reports: mockReports,
    });

    expect(result.coachingStatus).toBe('available');
    expect(result.coachingSummary).toContain('Junior AI Integration Engineer');
    expect(result.coachingSummary).toContain('Stage 3');
    expect(result.topRecommendation).toBeDefined();
    expect(result.generatedAt).toBeDefined();
    expect(result.tokenCost).toBeDefined();
  });
});
