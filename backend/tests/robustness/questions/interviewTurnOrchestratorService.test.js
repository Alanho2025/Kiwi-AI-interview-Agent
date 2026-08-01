import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { selectNextAction } from '../../../src/services/aiControl/actionPlanner.js';
import {
  buildCheapAnswerSignals,
  buildInterviewTurnPlan,
} from '../../../src/services/questions/interviewTurnOrchestratorService.js';

const baseDecisionContext = {
  currentTopic: 'React',
  interviewStructure: { focusAreaKey: 'technical' },
  evaluatorState: { interactionStatus: 'usable' },
  matchState: { validationTargets: ['testing evidence'] },
  coverageState: { missingTopics: ['testing evidence'] },
  environment: {
    latestAnswer: {
      text: 'I used React in the Forkcast project, mostly for the UI.',
      tokenCount: 11,
    },
  },
};

const baseSession = {
  id: 'session-1',
  settings: { focusArea: 'technical' },
  analysisResult: {
    parsedCvProfile: {
      evidenceProfile: {
        sections: {
          projects: [{ title: 'Forkcast', skills: ['React'] }],
        },
      },
    },
  },
  transcript: [
    {
      role: 'ai',
      questionId: 'opening-question',
      text: 'Please introduce yourself.',
      metadata: { stage: 'opening', topic: 'self_intro', questionType: 'self_intro' },
    },
    {
      role: 'user',
      text: 'I used React in the Forkcast project, mostly for the UI.',
    },
  ],
};

const poolItems = [
  {
    questionId: 'pool-1',
    status: 'active',
    questionRole: 'root_question',
    topic: 'testing evidence',
    category: 'technical',
    sourceType: 'match_gap',
    sourceStage: 'match_gap',
    text: 'How did you validate testing evidence?',
    priorityWeight: 0.9,
    coverageWeight: 0.9,
    riskWeight: 0.9,
    modeCompatibility: { technical: true, combined: true },
  },
  {
    questionId: 'pool-2',
    status: 'active',
    questionRole: 'root_question',
    topic: 'React',
    category: 'technical',
    sourceType: 'cv_project',
    sourceStage: 'cv_seed',
    text: 'How did you apply React?',
    priorityWeight: 0.8,
    coverageWeight: 0.7,
    riskWeight: 0.5,
    modeCompatibility: { technical: true, combined: true },
  },
  {
    questionId: 'pool-3',
    status: 'active',
    questionRole: 'root_question',
    topic: 'API',
    category: 'technical',
    sourceType: 'jd_requirement',
    sourceStage: 'match_validation',
    text: 'Tell me about API work.',
    priorityWeight: 0.4,
    coverageWeight: 0.4,
    riskWeight: 0.4,
    modeCompatibility: { technical: true, combined: true },
  },
  {
    questionId: 'pool-4',
    status: 'active',
    questionRole: 'root_question',
    topic: 'Database',
    category: 'technical',
    sourceType: 'cv_skill',
    sourceStage: 'cv_seed',
    text: 'Tell me about database work.',
    priorityWeight: 0.3,
    coverageWeight: 0.3,
    riskWeight: 0.3,
    modeCompatibility: { technical: true, combined: true },
  },
];

describe('interviewTurnOrchestratorService', () => {
  it('builds cheap answer signals without model calls', () => {
    const signals = buildCheapAnswerSignals({
      answerText: 'I used React in Forkcast, but I only briefly helped with the UI.',
      session: baseSession,
    });

    expect(signals).toEqual(expect.objectContaining({
      isShallow: true,
      isContentful: true,
      mentionedProjects: ['Forkcast'],
      technologyMentions: expect.arrayContaining(['react']),
    }));
    expect(signals.missingEvidence).toEqual(expect.arrayContaining(['result_or_validation']));
  });

  it('treats a shallow project introduction as a follow-up lane before root selection', async () => {
    const plan = await buildInterviewTurnPlan({
      session: baseSession,
      actionType: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
      decisionContext: baseDecisionContext,
      poolItems,
    });

    expect(plan.turnKind).toBe('follow_up');
    expect(plan.scenario).toBe('intro_follow_up');
    expect(plan.sourcePolicy).toBe('follow_up_from_parent_no_prepared_root_consumption');
    expect(plan.selectedRootCandidate).toBeNull();
    expect(plan.followUpContext).toEqual(expect.objectContaining({
      parentQuestionId: 'opening-question',
      followUpDepth: 1,
    }));
  });

  it('prepares root candidate space after scenario selection and limits top candidates to three', async () => {
    const plan = await buildInterviewTurnPlan({
      session: {
        ...baseSession,
        transcript: [{ role: 'ai', questionId: 'q1', metadata: { stage: 'technical', topic: 'React', followUpDepth: 2 } }],
      },
      actionType: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      decisionContext: {
        ...baseDecisionContext,
        environment: { latestAnswer: { text: 'I explained the React work with tests and validation details.', tokenCount: 10 } },
      },
      actionInput: { targetTopic: 'testing evidence', probeType: 'validation' },
      poolItems,
    });

    expect(plan.turnKind).toBe('root_question');
    expect(plan.scenario).toBe('root_match_gap');
    expect(plan.sourcePolicy).toBe('prepared_root_pool');
    expect(plan.selectedRootCandidate.questionId).toBe('pool-1');
    expect(plan.topRootCandidates).toHaveLength(3);
    expect(plan.planningFrame).toEqual(expect.objectContaining({
      scenario: 'root_match_gap',
      turnKind: 'root_question',
      topRootCandidates: expect.any(Array),
    }));
    expect(plan.latency).toEqual(expect.objectContaining({
      answerSignalBuildMs: expect.any(Number),
      rootCandidateRankMs: expect.any(Number),
      followUpContextBuildMs: expect.any(Number),
      orchestratorDecisionMs: expect.any(Number),
    }));
  });

  it('converts a follow-up action into a root lane when no AI parent question exists', async () => {
    const plan = await buildInterviewTurnPlan({
      session: { ...baseSession, transcript: [] },
      actionType: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      decisionContext: baseDecisionContext,
      poolItems,
    });

    expect(plan.turnKind).toBe('root_question');
    expect(plan.followUpContext).toBeNull();
    expect(plan.selectedRootCandidate).toEqual(expect.objectContaining({ questionId: 'pool-1' }));
  });

  it('uses a persisted warm-up slot to force a root and exclude later-phase candidates', async () => {
    const questionSet = {
      definition: {
        turnSlots: [{
          turn: 1,
          phase: 'warm_up',
          allowedQuestionKinds: ['root_question'],
          intendedPurpose: 'establish_candidate_context',
          policyReason: 'first_countable_turn_candidate_context',
        }],
        questionMap: {
          'warm-up': { targetId: 'target-warm-up' },
          'technical-later': { targetId: 'target-technical-later' },
        },
      },
      runtimeState: {
        coverageByTargetId: {
          'target-warm-up': { status: 'unseen' },
          'target-technical-later': { status: 'unseen' },
        },
      },
    };
    const plan = await buildInterviewTurnPlan({
      session: { ...baseSession, userId: 'user-1' },
      actionType: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      decisionContext: { ...baseDecisionContext, interviewStructure: { focusAreaKey: 'technical', nextTurnIndex: 1 } },
      poolItems: [
        { ...poolItems[0], questionId: 'technical-later', category: 'technical' },
        {
          ...poolItems[0],
          questionId: 'warm-up',
          category: 'opening',
          stage: 'opening',
          questionFamily: 'self_intro',
          questionIntent: 'self_intro',
          text: 'Could you introduce your most relevant background?',
        },
      ],
      loadQuestionSet: async () => questionSet,
    });

    expect(plan.turnKind).toBe('root_question');
    expect(plan.turnSlot).toEqual(expect.objectContaining({ phase: 'warm_up' }));
    expect(plan.phaseSelection.forcedRootQuestion).toBe(true);
    expect(plan.selectedRootCandidate.questionId).toBe('warm-up');
    expect(plan.rejectedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'technical-later', reason: 'phase_ineligible' }),
    ]));
  });

  it('records an explicit Role-Fit ranking latency marker without adding a new async decision step', async () => {
    const roleFitPool = [{
      ...poolItems[0],
      schemaVersion: 'v3',
      proofPointId: 'cov-intent-testing',
      coverageContractIds: ['cov-intent-testing'],
      testedRoleIntentIds: ['intent-testing'],
      recommendedEvidenceIds: ['evidence-testing'],
      evidenceAngle: 'validation',
      evidenceMapStrength: 0.8,
      coveragePriority: 'must_cover',
    }];
    const plan = await buildInterviewTurnPlan({
      session: {
        ...baseSession,
        transcript: [{ role: 'ai', questionId: 'q1', metadata: { stage: 'technical', topic: 'React', followUpDepth: 2 } }],
        interviewPlan: {
          roleFit: {
            proofStrategy: {
              artifactStatus: 'ready',
              mustCover: [{ coverageId: 'cov-intent-testing', roleIntentId: 'intent-testing', minQuestions: 1 }],
            },
          },
        },
      },
      actionType: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      decisionContext: {
        ...baseDecisionContext,
        environment: { latestAnswer: { text: 'I explained the React work with tests and validation details.', tokenCount: 10 } },
      },
      actionInput: { targetTopic: 'testing evidence', probeType: 'validation' },
      poolItems: roleFitPool,
    });

    expect(plan.selectedRootCandidate.questionId).toBe('pool-1');
    expect(plan.latency).toEqual(expect.objectContaining({
      roleFitQuestionRankingEnabled: true,
      roleFitQuestionRankingMs: expect.any(Number),
    }));
    expect(plan.latency.roleFitQuestionRankingMs).toBe(plan.latency.rootCandidateRankMs);
  });

  it('chooses an urgent reserved root instead of consuming the remaining budget on a follow-up', async () => {
    const plan = await buildInterviewTurnPlan({
      session: {
        ...baseSession,
        currentQuestionIndex: 6,
        questionLimit: 8,
        transcript: [
          {
            role: 'ai',
            questionId: 'root-react',
            text: 'How did you apply React?',
            metadata: { topic: 'React', questionFamily: 'role_specific', turnKind: 'root_question', countsAsQuestion: true },
          },
          { role: 'user', text: 'I built the React UI but did not explain how I tested it or handled a difficult trade-off.' },
        ],
      },
      actionType: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      decisionContext: {
        ...baseDecisionContext,
        environment: { latestAnswer: { text: 'I built the React UI but did not explain how I tested it or handled a difficult trade-off.', tokenCount: 18 } },
      },
      poolItems: [{
        ...poolItems[0],
        questionId: 'catalog-ai-workflow',
        topic: 'ai assisted delivery',
        text: 'How do you use AI while keeping ownership and verification?',
        sourceType: 'question_catalog',
        sourceStage: 'catalog',
        catalogQuestionId: 'ai_assisted_delivery',
        catalogVersion: '2026.1',
        catalogLifecycle: 'approved',
        questionFamily: 'ai_assisted_delivery',
        coverageSlot: 'software_ai_workflow',
        selectionPolicy: { minAsked: 1, maxAsked: 1, reservationPriority: 90 },
      }],
    });

    expect(plan.turnKind).toBe('root_question');
    expect(plan.selectedRootCandidate).toEqual(expect.objectContaining({
      questionId: 'catalog-ai-workflow',
      catalogQuestionId: 'ai_assisted_delivery',
      catalogVersion: '2026.1',
      coverageSlot: 'software_ai_workflow',
    }));
    expect(plan.followUpComparison).toEqual(expect.objectContaining({
      decision: 'next_root',
      reason: 'pending_coverage_reservation',
    }));
  });

  it('honours the general follow-up-versus-next-root decision when no reservation is urgent', async () => {
    const plan = await buildInterviewTurnPlan({
      session: {
        ...baseSession,
        settings: { ...baseSession.settings, seniorityLevel: 'Intermediate' },
        currentQuestionIndex: 2,
        questionLimit: 8,
      },
      actionType: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      decisionContext: {
        ...baseDecisionContext,
        environment: {
          latestAnswer: {
            text: 'I implemented the React screen, ran tests, measured the result, and documented the decision.',
            tokenCount: 14,
          },
        },
      },
      poolItems,
    });

    expect(plan.followUpComparison).toEqual(expect.objectContaining({
      decision: 'next_root',
      reason: 'next_root_opportunity_cost',
    }));
    expect(plan.turnKind).toBe('root_question');
    expect(plan.selectedRootCandidate).not.toBeNull();
  });

  it('detects solo heroics risk and triggers follow_up_teamwork scenario when teamwork is missing', async () => {
    const answerText = 'I did everything all by myself without anyone helping me on the entire project architecture.';
    const signals = buildCheapAnswerSignals({ answerText });

    expect(signals.soloHeroicsRisk).toBe(true);
    expect(signals.missingEvidence).toContain('teamwork_or_collaboration');

    const plan = await buildInterviewTurnPlan({
      session: {
        ...baseSession,
        currentQuestionIndex: 2,
        questionLimit: 8,
      },
      actionType: AGENT_ACTION_TYPES.ASK_PROBING_QUESTION,
      decisionContext: {
        ...baseDecisionContext,
        environment: {
          latestAnswer: {
            text: answerText,
            tokenCount: 15,
          },
        },
      },
      poolItems,
    });

    expect(plan.scenario).toBe('follow_up_teamwork');
    expect(plan.followUpIntent).toBe('teamwork');
  });

  it('triggers stress and friction probes in high_pressure stressLevel mode', () => {
    const plan = selectNextAction({
      currentTopic: 'React',
      focusArea: 'technical',
      questionContext: { stressLevel: 'high_pressure' },
      evaluatorState: { interactionStatus: 'usable', successStatus: 'usable', evidenceGainScore: 0.5 },
      interviewStructure: { focusAreaKey: 'technical', currentTopicState: { followUpCount: 1 } },
    });

    expect([AGENT_ACTION_TYPES.PROBE_STRESS, AGENT_ACTION_TYPES.PROBE_FRICTION]).toContain(plan.selectedAction);
  });
});
