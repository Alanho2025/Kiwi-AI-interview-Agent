import { describe, expect, it } from 'vitest';
import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { runInterviewerAgent } from '../../../src/services/agents/interviewerAgent.js';

describe('Interview question generation scenarios', () => {
  const baseSession = {
    transcript: [
      { role: 'ai', text: 'Tell me about a backend project.', metadata: { stage: 'technical_core', topic: 'backend_project' } },
      { role: 'user', text: 'I built APIs with Node.js and deployed them.', metadata: {} },
    ],
    interviewPlan: { questionPool: [] },
    totalQuestions: 6,
    currentQuestionIndex: 2,
  };

  const baseDecisionContext = {
    currentTopic: 'system_design',
    currentStage: 'technical_core',
    coverageState: { missingTopics: ['system_design'] },
    matchState: { validationTargets: ['api_security'] },
    sectionState: { sectionKey: 'technical', nextSectionKey: 'behavioural' },
    environment: {
      questionContext: { latestQuestionStage: 'technical_core', latestQuestionTopic: 'backend_project' },
      latestAnswer: { text: 'I built APIs with Node.js and deployed them.', tokenCount: 8 },
    },
    evaluatorState: { evidenceGainScore: 0.52, interactionStatus: 'thin', misunderstandingFlag: false },
    abductiveState: { shouldProbe: true, hiddenGap: 'production trade-offs', probeTopic: 'system_design' },
  };

  it('generates a rephrased question when misunderstanding is detected', async () => {
    const result = await runInterviewerAgent({ session: baseSession, actionType: AGENT_ACTION_TYPES.REPHRASE_QUESTION, decisionContext: baseDecisionContext, targetTopic: 'system_design' });
    expect(result.nextQuestion).toMatch(/Let me rephrase/i);
    expect(result.reactTrace.actionName).toBe(AGENT_ACTION_TYPES.REPHRASE_QUESTION);
  });

  it('generates an abductive probe when a hidden gap is inferred', async () => {
    const result = await runInterviewerAgent({ session: baseSession, actionType: AGENT_ACTION_TYPES.ASK_ABDUCTIVE_PROBE_QUESTION, decisionContext: baseDecisionContext, targetTopic: 'system_design' });
    expect(result.nextQuestion).toMatch(/trade-off|gap/i);
    expect(result.reactTrace.thoughtSummary).toMatch(/Hidden gap inferred/i);
  });

  it('generates a section shift question when the controller moves forward', async () => {
    const result = await runInterviewerAgent({ session: baseSession, actionType: AGENT_ACTION_TYPES.SHIFT_SECTION, decisionContext: baseDecisionContext, targetTopic: 'behavioural' });
    expect(result.nextQuestion).toMatch(/teamwork|challenge/i);
    expect(result.stage).toBe('behavioural');
  });
});
