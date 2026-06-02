import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
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
});
