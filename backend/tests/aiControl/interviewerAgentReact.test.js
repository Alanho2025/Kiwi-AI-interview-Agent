import { describe, expect, it } from 'vitest';
import { AGENT_ACTION_TYPES } from '../../src/constants/agentActionTypes.js';
import { runInterviewerAgent } from '../../src/services/agents/interviewerAgent.js';

describe('runInterviewerAgent', () => {
  const baseSession = {
    transcript: [
      { role: 'ai', text: 'Tell me about your system design experience.', metadata: { stage: 'technical_core', topic: 'system_design' } },
      { role: 'user', text: "Sorry, I'm not sure what you mean by that." },
    ],
    interviewPlan: { questionPool: [{ text: 'Please introduce yourself.', stage: 'opening', topic: 'self_intro' }] },
    currentQuestionIndex: 1,
    totalQuestions: 6,
  };

  it('returns a rephrased question with react trace when misunderstanding is flagged', async () => {
    const result = await runInterviewerAgent({
      session: baseSession,
      actionType: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      decisionContext: {
        currentStage: 'technical_core',
        currentTopic: 'system_design',
        coverageState: { missingTopics: ['system_design'] },
        matchState: { validationTargets: [] },
        environment: { latestAnswer: { text: "Sorry, I'm not sure what you mean.", tokenCount: 7 }, questionContext: { latestQuestionStage: 'technical_core', latestQuestionTopic: 'system_design' } },
        evaluatorState: { misunderstandingFlag: true, interactionStatus: 'degraded' },
      },
    });
    expect(result.nextQuestion).toContain('Let me rephrase');
    expect(result.reactTrace.actionName).toBe(AGENT_ACTION_TYPES.REPHRASE_QUESTION);
    expect(result.reactTrace.thoughtSummary).toContain('system_design');
  });

  it('returns an abductive probe when the controller asks for one', async () => {
    const result = await runInterviewerAgent({
      session: baseSession,
      actionType: AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION,
      decisionContext: {
        currentStage: 'technical_core',
        currentTopic: 'deployment',
        abductiveState: { hiddenGap: 'deployment_depth', probeTopic: 'deployment', shouldProbe: true },
        environment: { latestAnswer: { text: 'I worked on the project but not in production.', tokenCount: 10 }, questionContext: { latestQuestionStage: 'technical_core', latestQuestionTopic: 'deployment' } },
        evaluatorState: { misunderstandingFlag: false, interactionStatus: 'thin', evidenceGainScore: 0.4 },
      },
    });
    expect(result.nextQuestion).toContain('deployment_depth');
    expect(result.reactTrace.actionName).toBe(AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION);
  });

  it('builds a matched technical question when recovering coverage in combined mode', async () => {
    const result = await runInterviewerAgent({
      session: {
        ...baseSession,
        analysisResult: {
          matchingDetails: { topMatchedSkills: ['React', 'PostgreSQL'], questionPlanHints: { priorityTopics: ['AWS'] } },
        },
        settings: { focusArea: 'Combined' },
      },
      actionType: AGENT_ACTION_TYPES.SHIFT_SECTION,
      category: 'technical',
      probeType: 'technical_recovery',
      decisionContext: {
        currentStage: 'behavioural',
        currentTopic: 'teamwork',
        interviewStructure: { forceCategory: 'technical', focusAreaKey: 'combined', shouldCloseSoon: false },
        matchState: { validationTargets: [] },
      },
    });
    expect(result.nextQuestion.toLowerCase()).toMatch(/react|postgresql|aws/);
    expect(result.questionCategory).toBe('technical');
  });
});
