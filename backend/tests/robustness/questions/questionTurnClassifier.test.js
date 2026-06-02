import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { buildInterviewTurnPlan } from '../../../src/services/questions/interviewTurnOrchestratorService.js';

const poolItems = [{
  questionId: 'prepared-root-1',
  status: 'active',
  questionRole: 'root_question',
  topic: 'React',
  category: 'technical',
  sourceType: 'cv_project',
  sourceStage: 'cv_seed',
  text: 'How did you apply React in Forkcast?',
  priorityWeight: 0.8,
  coverageWeight: 0.7,
  riskWeight: 0.4,
  modeCompatibility: { technical: true, combined: true },
}];

const decisionContext = {
  currentTopic: 'React',
  interviewStructure: { focusAreaKey: 'technical' },
  environment: { latestAnswer: { text: 'I used React in Forkcast for the UI.', tokenCount: 8 } },
};

const introSession = {
  id: 'session-classifier',
  settings: { focusArea: 'technical' },
  analysisResult: {
    parsedCvProfile: {
      evidenceProfile: { sections: { projects: [{ title: 'Forkcast' }] } },
    },
  },
  transcript: [
    { role: 'ai', questionId: 'intro-q', metadata: { stage: 'opening', questionType: 'self_intro', topic: 'self_intro' } },
    { role: 'user', text: 'I used React in Forkcast for the UI.' },
  ],
};

describe('question turn classifier contract', () => {
  it('classifies shallow project introductions as follow-up turns', async () => {
    const plan = await buildInterviewTurnPlan({
      session: introSession,
      actionType: AGENT_ACTION_TYPES.ASK_POOL_QUESTION,
      decisionContext,
      poolItems,
    });

    expect(plan.turnKind).toBe('follow_up');
    expect(plan.scenario).toBe('intro_follow_up');
    expect(plan.sourcePolicy).toBe('follow_up_from_parent_no_prepared_root_consumption');
  });

  it('classifies validation turns with prepared match gaps as root turns', async () => {
    const plan = await buildInterviewTurnPlan({
      session: {
        ...introSession,
        transcript: [
          { role: 'ai', questionId: 'q1', metadata: { stage: 'technical', topic: 'React', followUpDepth: 2 } },
          { role: 'user', text: 'I owned the UI and tested it before release.' },
        ],
      },
      actionType: AGENT_ACTION_TYPES.ASK_VALIDATION_QUESTION,
      decisionContext: {
        ...decisionContext,
        matchState: { validationTargets: ['React'] },
        environment: { latestAnswer: { text: 'I owned the UI and tested it before release.', tokenCount: 9 } },
      },
      poolItems,
    });

    expect(plan.turnKind).toBe('root_question');
    expect(plan.scenario).toBe('root_match_gap');
    expect(plan.selectedRootCandidate.questionId).toBe('prepared-root-1');
  });

  it('classifies rephrase actions as repair turns', async () => {
    const plan = await buildInterviewTurnPlan({
      session: introSession,
      actionType: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      decisionContext,
      poolItems,
    });

    expect(plan.turnKind).toBe('repair');
    expect(plan.scenario).toBe('rephrase');
    expect(plan.sourcePolicy).toBe('fallback_root_policy');
  });
});
