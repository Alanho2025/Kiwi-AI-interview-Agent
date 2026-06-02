import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { buildInterviewTurnPlan } from '../../../src/services/questions/interviewTurnOrchestratorService.js';

const poolItems = [
  {
    questionId: 'gap-root',
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
    questionId: 'cv-root',
    status: 'active',
    questionRole: 'root_question',
    topic: 'React',
    category: 'technical',
    sourceType: 'cv_project',
    sourceStage: 'cv_seed',
    text: 'How did you apply React in Forkcast?',
    priorityWeight: 0.7,
    coverageWeight: 0.7,
    riskWeight: 0.5,
    modeCompatibility: { technical: true, combined: true },
  },
];

const decisionContext = {
  currentTopic: 'React',
  interviewStructure: { focusAreaKey: 'technical' },
  evaluatorState: { interactionStatus: 'usable' },
  matchState: { validationTargets: ['testing evidence'] },
  coverageState: { missingTopics: ['testing evidence'] },
  environment: {
    latestAnswer: { text: 'I used React in Forkcast for the UI.', tokenCount: 8 },
  },
};

describe('root/follow-up runtime flow', () => {
  it('keeps shallow intro follow-up on the parent topic without consuming prepared roots, then returns to root selection', async () => {
    const introSession = {
      id: 'session-1',
      settings: { focusArea: 'technical' },
      analysisResult: {
        parsedCvProfile: {
          evidenceProfile: { sections: { projects: [{ title: 'Forkcast', skills: ['React'] }] } },
        },
      },
      transcript: [
        { role: 'ai', questionId: 'opening', metadata: { stage: 'opening', topic: 'self_intro' } },
        { role: 'user', text: 'I used React in Forkcast for the UI.' },
      ],
    };

    const followUpPlan = await buildInterviewTurnPlan({
      session: introSession,
      actionType: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
      decisionContext,
      poolItems,
    });

    expect(followUpPlan.turnKind).toBe('follow_up');
    expect(followUpPlan.scenario).toBe('intro_follow_up');
    expect(followUpPlan.selectedRootCandidate).toBeNull();
    expect(followUpPlan.sourcePolicy).toBe('follow_up_from_parent_no_prepared_root_consumption');

    const nextRootPlan = await buildInterviewTurnPlan({
      session: {
        ...introSession,
        transcript: [
          ...introSession.transcript,
          {
            role: 'ai',
            questionId: 'follow-up-1',
            metadata: {
              stage: 'technical',
              topic: 'React',
              followUpDepth: 2,
              rootQuestionId: 'opening',
            },
          },
          { role: 'user', text: 'I owned the component and validated it with tests.' },
        ],
      },
      actionType: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      decisionContext: {
        ...decisionContext,
        environment: { latestAnswer: { text: 'I owned the component and validated it with tests.', tokenCount: 9 } },
      },
      actionInput: { targetTopic: 'testing evidence', probeType: 'validation' },
      poolItems,
    });

    expect(nextRootPlan.turnKind).toBe('root_question');
    expect(nextRootPlan.scenario).toBe('root_match_gap');
    expect(nextRootPlan.selectedRootCandidate.questionId).toBe('gap-root');
  });
});
