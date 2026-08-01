import { describe, expect, it, vi } from 'vitest';

import {
  applyUserInterviewMemoryQuestionPolicy,
  buildUserInterviewMemoryProjection,
  refreshUserInterviewMemoryProjection,
} from '../../../src/services/aiControl/userInterviewMemoryService.js';
import { buildTrajectoryStep } from '../../../src/services/aiControl/trajectoryService.js';

const now = new Date('2026-07-15T12:00:00.000Z');

const analysis = ({
  sessionId,
  roleKey = 'backend_engineer',
  topic = 'system_design',
  evidenceGainScore = 0.82,
  specificity = 'high',
  createdAt = '2026-07-10T12:00:00.000Z',
  trajectoryRecords = null,
} = {}) => ({
  sessionId,
  userId: 'user-memory-1',
  matchingDetails: { questionPlanHints: { roleCanonical: roleKey } },
  trajectoryRecords: trajectoryRecords || [{
    trajectoryId: `trajectory:${sessionId}`,
    workflowRunId: `run:${sessionId}`,
    createdAt,
    answeredQuestion: {
      questionId: `question:${sessionId}`,
      preparedQuestionId: `prepared:${sessionId}`,
      topic,
      questionFamily: 'role_specific',
    },
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
    const partialConflict = buildUserInterviewMemoryProjection({
      analyses: [
        analysis({ sessionId: 'session-1' }),
        analysis({ sessionId: 'session-2' }),
        analysis({ sessionId: 'session-3', evidenceGainScore: 0.6, specificity: 'medium' }),
      ],
      currentRoleKey: 'backend_engineer',
      now,
    });

    expect(oneSession.routineRepeatSuppressions).toEqual([]);
    expect(roleMismatch.routineRepeatSuppressions).toEqual([]);
    expect(stale.routineRepeatSuppressions).toEqual([]);
    expect(conflict.routineRepeatSuppressions).toEqual([]);
    expect(partialConflict.routineRepeatSuppressions).toEqual([]);
    expect(conflict.revalidationDue).toEqual(expect.arrayContaining([
      expect.objectContaining({ competencyKey: 'system_design', reasonCode: 'conflicting_cross_session_evidence' }),
    ]));
  });

  it('does not promote legacy trajectory targets that lack an answered-question reference', () => {
    const legacyTrajectory = (sessionId) => ({
      trajectoryId: `legacy:${sessionId}`,
      workflowRunId: `run:${sessionId}`,
      createdAt: '2026-07-10T12:00:00.000Z',
      targetTopic: 'next_action_topic',
      selectedAction: 'ASK_DEEP_DIVE_QUESTION',
      actionInput: { targetTopic: 'next_action_topic', probeType: 'deepen' },
      evaluator: { evidenceGainScore: 0.82, specificity: 'high' },
    });
    const projection = buildUserInterviewMemoryProjection({
      analyses: [
        analysis({ sessionId: 'session-1', trajectoryRecords: [legacyTrajectory('session-1')] }),
        analysis({ sessionId: 'session-2', trajectoryRecords: [legacyTrajectory('session-2')] }),
      ],
      currentRoleKey: 'backend_engineer',
      now,
    });

    expect(projection.contributions).toEqual([]);
    expect(projection.routineRepeatSuppressions).toEqual([]);
  });

  it('attributes cross-session evidence to the answered question rather than the next selected question', () => {
    const trajectory = (sessionId) => ({
      ...buildTrajectoryStep({
        session: {
          id: sessionId,
          transcript: [
            { role: 'user', text: 'I built this service.' },
            {
              role: 'ai',
              questionId: 'question-api-design',
              metadata: {
                countsAsQuestion: true,
                preparedQuestionId: 'prepared-api-design',
                topic: 'api_design',
                questionFamily: 'role_specific',
              },
            },
          ],
        },
        decisionContext: { currentTopic: 'api_design' },
        actionInput: { targetTopic: 'api_design' },
        actorOutput: { topic: 'observability', nextQuestion: 'How would you monitor it?' },
        evaluatorOutput: { evidenceGainScore: 0.82, specificity: 'high' },
      }),
      createdAt: '2026-07-10T12:00:00.000Z',
      workflowRunId: `run:${sessionId}`,
    });
    const firstTrajectory = trajectory('session-1');
    const projection = buildUserInterviewMemoryProjection({
      analyses: [
        analysis({ sessionId: 'session-1', trajectoryRecords: [firstTrajectory] }),
        analysis({ sessionId: 'session-2', trajectoryRecords: [trajectory('session-2')] }),
      ],
      currentRoleKey: 'backend_engineer',
      now,
    });

    expect(firstTrajectory).toMatchObject({
      targetTopic: 'api_design',
      section: 'role_specific',
      answeredQuestion: {
        questionId: 'question-api-design',
        preparedQuestionId: 'prepared-api-design',
        topic: 'api_design',
        questionFamily: 'role_specific',
      },
    });
    expect(projection.routineRepeatSuppressions).toEqual([
      expect.objectContaining({ competencyKey: 'api_design', questionFamilyKey: 'role_specific' }),
    ]);
    expect(projection.routineRepeatSuppressions).not.toEqual([
      expect.objectContaining({ competencyKey: 'observability' }),
    ]);
  });

  it('suppresses only promoted routine roots and retains weak or partial targets for revalidation', () => {
    const candidates = [
      { questionId: 'api-root', questionRole: 'root_question', category: 'technical', topic: 'api_design', questionFamily: 'role_specific', priorityWeight: 0.9 },
      { questionId: 'testing-root', questionRole: 'root_question', category: 'technical', topic: 'testing', questionFamily: 'role_specific', priorityWeight: 0.5 },
      { questionId: 'intro-root', questionRole: 'root_question', category: 'opening', topic: 'api_design', questionFamily: 'role_specific', priorityWeight: 0.9 },
      { questionId: 'api-fallback', questionRole: 'fallback_root', category: 'technical', topic: 'api_design', questionFamily: 'role_specific', priorityWeight: 0.9 },
    ];
    const projection = {
      policyVersion: 'user_interview_memory_v0',
      planningEnabled: true,
      currentRoleKey: 'backend_engineer',
      policy: { canAffectScoring: false },
      routineRepeatSuppressions: [{
        competencyKey: 'api_design',
        questionFamilyKey: 'role_specific',
        canSuppressRoutineRepeat: true,
      }],
      routineRepeatPriorities: [{
        competencyKey: 'testing',
        questionFamilyKey: 'role_specific',
        reasonCode: 'weak_or_partial_evidence_requires_revalidation',
      }],
    };

    const applied = applyUserInterviewMemoryQuestionPolicy({ items: candidates, projection });
    const disabled = applyUserInterviewMemoryQuestionPolicy({
      items: candidates,
      projection: { ...projection, planningEnabled: false },
    });

    expect(applied.items.map((item) => item.questionId)).toEqual(['testing-root', 'intro-root', 'api-fallback']);
    expect(applied.items[0]).toMatchObject({
      priorityWeight: 0.68,
      crossSessionMemoryPolicy: {
        action: 'retain_and_boost_for_revalidation',
        reasonCode: 'weak_or_partial_evidence_requires_revalidation',
      },
    });
    expect(applied.decision).toMatchObject({
      status: 'applied',
      suppressedRootCount: 1,
      boostedRootCount: 1,
      canAffectScoring: false,
    });
    expect(disabled.items).toEqual(candidates);
    expect(disabled.decision).toMatchObject({ status: 'not_applied' });
  });

  it('does not read or persist cross-session history when planning is disabled', async () => {
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

    expect(loadAnalyses).not.toHaveBeenCalled();
    expect(persistProjection).not.toHaveBeenCalled();
    expect(projection).toBeNull();

    const enabledProjection = await refreshUserInterviewMemoryProjection({
      userId: 'user-memory-1',
      currentSessionId: 'current-session',
      currentRoleKey: 'backend_engineer',
      planningEnabled: true,
      now,
      loadAnalyses,
      persistProjection,
    });

    expect(loadAnalyses).toHaveBeenCalledWith({
      userId: 'user-memory-1',
      currentSessionId: 'current-session',
    });
    expect(persistProjection).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'current-session',
      projection: expect.objectContaining({ planningEnabled: true }),
    }));
    expect(enabledProjection.sourceKind).toBe('recomputable_session_analysis_projection');
  });
});
