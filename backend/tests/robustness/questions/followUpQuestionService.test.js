import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getPreparedQuestionPool: vi.fn(),
  callDeepSeek: vi.fn(),
}));

vi.mock('../../../src/services/questions/questionPoolComposerService.js', async () => {
  const actual = await vi.importActual('../../../src/services/questions/questionPoolComposerService.js');
  return {
    ...actual,
    getPreparedQuestionPool: mocks.getPreparedQuestionPool,
  };
});

vi.mock('../../../src/services/deepseekService.js', () => ({
  callDeepSeek: mocks.callDeepSeek,
}));

const { runInterviewerAgent } = await import('../../../src/services/agents/interviewerAgent.js');
const { AGENT_ACTION_TYPES } = await import('../../../src/constants/agentActionTypes.js');

const parentSession = {
  id: 'session-follow-up',
  currentQuestionIndex: 3,
  totalQuestions: 8,
  settings: { focusArea: 'technical' },
  transcript: [
    {
      role: 'ai',
      questionId: 'root-q-1',
      text: 'How did you apply React in Forkcast?',
      metadata: {
        topic: 'React',
        followUpDepth: 0,
        rootQuestionId: 'root-q-1',
        questionDecision: { preparedQuestionId: 'prepared-root-1' },
      },
    },
    { role: 'user', text: 'I used React in Forkcast for the UI but did not explain ownership.' },
  ],
};

const decisionContext = {
  currentTopic: 'React',
  currentStage: 'technical',
  interviewStructure: { focusAreaKey: 'technical' },
  environment: {
    latestAnswer: { text: 'I used React in Forkcast for the UI but did not explain ownership.', tokenCount: 12 },
  },
  matchState: { validationTargets: ['React'] },
  coverageState: { missingTopics: ['React'] },
};

describe('follow-up question generation contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getPreparedQuestionPool.mockResolvedValue([{
      questionId: 'prepared-root-2',
      status: 'active',
      questionRole: 'root_question',
      topic: 'testing evidence',
      category: 'technical',
      sourceType: 'match_gap',
      sourceStage: 'match_gap',
      text: 'How did you validate the testing evidence?',
      fallbackText: 'How did you validate the testing evidence?',
      priorityWeight: 0.9,
      coverageWeight: 0.9,
      riskWeight: 0.9,
      modeCompatibility: { technical: true, combined: true },
    }]);
    mocks.callDeepSeek.mockResolvedValue({
      content: JSON.stringify({
        selectedAngle: 'React ownership',
        shortReason: 'The answer names the project but lacks ownership evidence.',
        finalSpokenQuestion: 'What part of the React work did you personally own?',
        evidenceUsed: ['latest_answer:React'],
        riskFlags: [],
      }),
    });
  });

  it('keeps follow-ups on the parent topic and preserves parent metadata', async () => {
    const result = await runInterviewerAgent({
      session: parentSession,
      actionType: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      decisionContext,
      targetTopic: 'React',
    });

    expect(result.turnKind).toBe('follow_up');
    expect(result.preparedQuestionId).toBeNull();
    expect(result.parentQuestionId).toBe('root-q-1');
    expect(result.parentPreparedQuestionId).toBe('prepared-root-1');
    expect(result.rootQuestionId).toBe('root-q-1');
    expect(result.rootTopic).toBe('React');
    expect(result.followUpIntent).toBe('validation');
    expect(result.displayText).toBe('What part of the React work did you personally own?');
  });

  it('streams the guarded bounded JSON question through onSentence without a free-form streaming LLM path', async () => {
    const onSentence = vi.fn();

    const result = await runInterviewerAgent({
      session: parentSession,
      actionType: AGENT_ACTION_TYPES.ASK_DEEP_DIVE_QUESTION,
      decisionContext,
      targetTopic: 'React',
      onSentence,
    });

    expect(mocks.callDeepSeek).toHaveBeenCalledTimes(1);
    expect(mocks.callDeepSeek.mock.calls[0][2].usageMetadata).toEqual(expect.objectContaining({
      operation: 'llm_json',
      feature: 'bounded_question_micro_planning',
    }));
    expect(onSentence).toHaveBeenCalledWith('What part of the React work did you personally own?', 0);
    expect(result.questionDecision.selectedAngle).toBe('React ownership');
    expect(result.latency.llmCompleteMs).toEqual(expect.any(Number));
  });
});
