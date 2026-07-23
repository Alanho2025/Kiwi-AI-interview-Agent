import { describe, expect, it, vi } from 'vitest';

import {
  buildUserInterviewMemoryProjection,
  refreshUserInterviewMemoryProjection,
} from '../../../src/services/aiControl/userInterviewMemoryService.js';

const now = new Date('2026-07-15T12:00:00.000Z');

const analysis = ({
  sessionId,
  roleKey = 'backend_engineer',
  topic = 'system_design',
  evidenceGainScore = 0.82,
  specificity = 'high',
  createdAt = '2026-07-10T12:00:00.000Z',
} = {}) => ({
  sessionId,
  userId: 'user-memory-1',
  matchingDetails: { questionPlanHints: { roleCanonical: roleKey } },
  trajectoryRecords: [{
    trajectoryId: `trajectory:${sessionId}`,
    workflowRunId: `run:${sessionId}`,
    createdAt,
    targetTopic: topic,
    selectedAction: 'ASK_DEEP_DIVE_QUESTION',
    actionInput: { probeType: 'deepen' },
    plannerSignals: { evidenceGainScore, specificity },
    evaluator: { evidenceGainScore, specificity },
    latestAnswer: 'private answer that must never enter the projection',
    generatedQuestion: 'private generated question that must never enter the projection',
  }],
});

describe('M3 user interview memory projection', () => {
  it('promotes routine-repeat suppression only after two independent fresh sessions', () => {
    const projection = buildUserInterviewMemoryProjection({
      analyses: [analysis({ sessionId: 'session-1' }), analysis({ sessionId: 'session-2' })],
      currentRoleKey: 'backend_engineer',
      now,
    });

    expect(projection.routineRepeatSuppressions).toEqual([
      expect.objectContaining({
        competencyKey: 'system_design',
        independentSessionCount: 2,
        canSuppressRoutineRepeat: true,
        recommendedNextDepth: 'advanced',
      }),
    ]);
    expect(projection.policy.canAffectScoring).toBe(false);
    expect(JSON.stringify(projection)).not.toContain('private answer');
    expect(JSON.stringify(projection)).not.toContain('private generated question');
  });

  it('does not suppress after one session, a role mismatch, stale evidence, or conflict', () => {
    const oneSession = buildUserInterviewMemoryProjection({
      analyses: [analysis({ sessionId: 'session-1' })],
      currentRoleKey: 'backend_engineer',
      now,
    });
    const roleMismatch = buildUserInterviewMemoryProjection({
      analyses: [analysis({ sessionId: 'session-1' }), analysis({ sessionId: 'session-2' })],
      currentRoleKey: 'product_manager',
      now,
    });
    const stale = buildUserInterviewMemoryProjection({
      analyses: [
        analysis({ sessionId: 'session-1', createdAt: '2025-01-01T00:00:00.000Z' }),
        analysis({ sessionId: 'session-2', createdAt: '2025-01-02T00:00:00.000Z' }),
      ],
      currentRoleKey: 'backend_engineer',
      now,
    });
    const conflict = buildUserInterviewMemoryProjection({
      analyses: [
        analysis({ sessionId: 'session-1' }),
        analysis({ sessionId: 'session-2' }),
        analysis({ sessionId: 'session-3', evidenceGainScore: 0.3, specificity: 'low' }),
      ],
      currentRoleKey: 'backend_engineer',
      now,
    });

    expect(oneSession.routineRepeatSuppressions).toEqual([]);
    expect(roleMismatch.routineRepeatSuppressions).toEqual([]);
    expect(stale.routineRepeatSuppressions).toEqual([]);
    expect(conflict.routineRepeatSuppressions).toEqual([]);
    expect(conflict.revalidationDue).toEqual(expect.arrayContaining([
      expect.objectContaining({ competencyKey: 'system_design', reasonCode: 'conflicting_cross_session_evidence' }),
    ]));
  });

  it('refreshes a session-owned projection without creating a second long-term memory source', async () => {
    const loadAnalyses = vi.fn().mockResolvedValue([
      analysis({ sessionId: 'historical-1' }),
      analysis({ sessionId: 'historical-2' }),
    ]);
    const persistProjection = vi.fn().mockResolvedValue(null);

    const projection = await refreshUserInterviewMemoryProjection({
      userId: 'user-memory-1',
      currentSessionId: 'current-session',
      currentRoleKey: 'backend_engineer',
      planningEnabled: false,
      now,
      loadAnalyses,
      persistProjection,
    });

    expect(loadAnalyses).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-memory-1',
      currentSessionId: 'current-session',
    }));
    expect(persistProjection).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'current-session',
      projection: expect.objectContaining({ planningEnabled: false }),
    }));
    expect(projection.sourceKind).toBe('recomputable_session_analysis_projection');
  });
});
