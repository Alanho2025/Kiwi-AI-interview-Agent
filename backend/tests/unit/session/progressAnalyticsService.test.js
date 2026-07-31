import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateProgressAnalytics } from '../../../src/services/session/progressAnalyticsService.js';

describe('progressAnalyticsService (Phase A Deterministic Aggregation)', () => {
  const userId = 'user-123-abc';
  const targetRole = 'Junior AI Integration Engineer';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('5-Layer Pipeline Filtering & Edge Cases ($N < 2$)', () => {
    it('returns insufficient_data status when user has 0 sessions', async () => {
      const result = await calculateProgressAnalytics({
        userId,
        targetRole,
        deliveryMode: 'text',
        sessions: [],
        reports: [],
      });

      expect(result.analyticsStatus).toBe('insufficient_data');
      expect(result.sessionCount).toBe(0);
      expect(result.message).toContain('At least 2 comparable sessions are required');
    });

    it('returns insufficient_data status when user has only 1 comparable session', async () => {
      const mockSessions = [
        {
          id: 'sess-1',
          user_id: userId,
          target_role: targetRole,
          status: 'completed',
          mode: 'text',
          deleted_at: null,
          created_at: new Date('2026-07-20T10:00:00Z'),
        },
      ];
      const mockReports = [
        {
          sessionId: 'sess-1',
          userId,
          latestStatus: 'ready',
          schemaVersion: 'v7',
          report: {
            overallScore: 65,
            acceptedEligibleTurns: 5,
            directPastCount: 3,
            adjacentCount: 1,
            hypotheticalCount: 1,
            fillerCount: 0,
          },
        },
      ];

      const result = await calculateProgressAnalytics({
        userId,
        targetRole,
        deliveryMode: 'text',
        sessions: mockSessions,
        reports: mockReports,
      });

      expect(result.analyticsStatus).toBe('insufficient_data');
      expect(result.sessionCount).toBe(1);
    });

    it('filters out deleted, in-progress, non-v7 schema, or draft sessions', async () => {
      const mockSessions = [
        // Valid 1
        { id: 'sess-1', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: null, created_at: new Date('2026-07-20T10:00:00Z') },
        // Invalid: deleted
        { id: 'sess-2', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: new Date(), created_at: new Date('2026-07-21T10:00:00Z') },
        // Invalid: status in_progress
        { id: 'sess-3', user_id: userId, target_role: targetRole, status: 'in_progress', mode: 'text', deleted_at: null, created_at: new Date('2026-07-22T10:00:00Z') },
        // Invalid: different mode (voice vs text)
        { id: 'sess-4', user_id: userId, target_role: targetRole, status: 'completed', mode: 'voice', deleted_at: null, created_at: new Date('2026-07-23T10:00:00Z') },
        // Valid 2
        { id: 'sess-5', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: null, created_at: new Date('2026-07-24T10:00:00Z') },
      ];

      const mockReports = [
        { sessionId: 'sess-1', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 60, acceptedEligibleTurns: 4, directPastCount: 2, hypotheticalCount: 2 } },
        { sessionId: 'sess-2', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 70, acceptedEligibleTurns: 4, directPastCount: 3 } },
        { sessionId: 'sess-3', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 50, acceptedEligibleTurns: 4, directPastCount: 1 } },
        { sessionId: 'sess-4', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 80, acceptedEligibleTurns: 4, directPastCount: 4 } },
        // Invalid: draft status
        { sessionId: 'sess-5', userId, latestStatus: 'draft', schemaVersion: 'v7', report: { overallScore: 75, acceptedEligibleTurns: 4, directPastCount: 3 } },
      ];

      const result = await calculateProgressAnalytics({
        userId,
        targetRole,
        deliveryMode: 'text',
        sessions: mockSessions,
        reports: mockReports,
      });

      // Only 1 session (sess-1) is valid (sess-5 has latestStatus draft), so total valid is 1 -> insufficient_data
      expect(result.analyticsStatus).toBe('insufficient_data');
      expect(result.sessionCount).toBe(1);
    });
  });

  describe('Deterministic Analytics Calculation ($N >= 2$)', () => {
    it('calculates deterministic progress analytics for N=2 valid sessions', async () => {
      const mockSessions = [
        { id: 'sess-1', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: null, created_at: new Date('2026-07-20T10:00:00Z') },
        { id: 'sess-2', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: null, created_at: new Date('2026-07-22T10:00:00Z') },
      ];

      const mockReports = [
        {
          sessionId: 'sess-1',
          userId,
          latestStatus: 'ready',
          schemaVersion: 'v7',
          report: {
            overallScore: 60,
            acceptedEligibleTurns: 5,
            directPastCount: 2,
            adjacentCount: 1,
            hypotheticalCount: 2,
            fillerCount: 0,
          },
        },
        {
          sessionId: 'sess-2',
          userId,
          latestStatus: 'ready_after_repair',
          schemaVersion: 'v7',
          report: {
            overallScore: 78,
            acceptedEligibleTurns: 5,
            directPastCount: 4,
            adjacentCount: 1,
            hypotheticalCount: 0,
            fillerCount: 0,
          },
        },
      ];

      const result = await calculateProgressAnalytics({
        userId,
        targetRole,
        deliveryMode: 'text',
        sessions: mockSessions,
        reports: mockReports,
      });

      expect(result.analyticsStatus).toBe('available');
      expect(result.sessionCount).toBe(2);
      expect(result.targetRole).toBe(targetRole);
      expect(result.roleCoveragePercent).toBe(78);
      expect(result.readinessStage).toBe('Stage 3: Consistently Demonstrated');

      // Evidence evolution array length = 2
      expect(result.evidenceEvolution).toHaveLength(2);
      expect(result.evidenceEvolution[0].directPastPercent).toBe(40); // 2/5 = 40%
      expect(result.evidenceEvolution[1].directPastPercent).toBe(80); // 4/5 = 80%
    });

    it('calculates deterministic progress analytics for N=5 valid sessions and maps readiness stage', async () => {
      const mockSessions = Array.from({ length: 5 }, (_, i) => ({
        id: `sess-${i + 1}`,
        user_id: userId,
        target_role: targetRole,
        status: 'completed',
        mode: 'text',
        deleted_at: null,
        created_at: new Date(`2026-07-${20 + i}T10:00:00Z`),
      }));

      const mockReports = [
        { sessionId: 'sess-1', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 40, acceptedEligibleTurns: 4, directPastCount: 1, hypotheticalCount: 3 } },
        { sessionId: 'sess-2', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 55, acceptedEligibleTurns: 4, directPastCount: 2, hypotheticalCount: 2 } },
        { sessionId: 'sess-3', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 68, acceptedEligibleTurns: 4, directPastCount: 3, hypotheticalCount: 1 } },
        { sessionId: 'sess-4', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 82, acceptedEligibleTurns: 4, directPastCount: 4, hypotheticalCount: 0 } },
        { sessionId: 'sess-5', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 88, acceptedEligibleTurns: 4, directPastCount: 4, hypotheticalCount: 0 } },
      ];

      const result = await calculateProgressAnalytics({
        userId,
        targetRole,
        deliveryMode: 'text',
        sessions: mockSessions,
        reports: mockReports,
      });

      expect(result.analyticsStatus).toBe('available');
      expect(result.sessionCount).toBe(5);
      expect(result.roleCoveragePercent).toBe(88);
      expect(result.readinessStage).toBe('Stage 4: Strong Practice Evidence');
      expect(result.evidenceEvolution).toHaveLength(5);
      expect(result.evidenceEvolution[4].directPastPercent).toBe(100);
    });

    it('handles missing fields gracefully by marking availabilityStatus: "unavailable" without crashing', async () => {
      const mockSessions = [
        { id: 'sess-1', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: null, created_at: new Date('2026-07-20T10:00:00Z') },
        { id: 'sess-2', user_id: userId, target_role: targetRole, status: 'completed', mode: 'text', deleted_at: null, created_at: new Date('2026-07-22T10:00:00Z') },
      ];

      const mockReports = [
        { sessionId: 'sess-1', userId, latestStatus: 'ready', schemaVersion: 'v7', report: null }, // missing report
        { sessionId: 'sess-2', userId, latestStatus: 'ready', schemaVersion: 'v7', report: { overallScore: 70, acceptedEligibleTurns: 4, directPastCount: 3 } },
      ];

      const result = await calculateProgressAnalytics({
        userId,
        targetRole,
        deliveryMode: 'text',
        sessions: mockSessions,
        reports: mockReports,
      });

      expect(result.analyticsStatus).toBe('available');
      expect(result.evidenceEvolution[0].availabilityStatus).toBe('unavailable');
      expect(result.evidenceEvolution[1].availabilityStatus).toBe('available');
    });
  });
});
