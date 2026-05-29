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
  callDeepSeekStream: vi.fn(),
}));

const { runInterviewerAgent } = await import('../../../src/services/agents/interviewerAgent.js');

const buildSession = () => ({
  id: 'session-1',
  currentQuestionIndex: 2,
  totalQuestions: 8,
  settings: { focusArea: 'Combined' },
  transcript: [{ role: 'user', text: 'I used MongoDB and PostgreSQL for different data needs.' }],
  interviewPlan: {
    questionPool: [{
      type: 'technical_core',
      category: 'technical',
      stage: 'technical',
      topic: 'legacy',
      text: 'Tell me about one legacy technical task.',
      sourceType: 'cv_template',
    }],
  },
});

const decisionContext = {
  currentTopic: 'database',
  currentStage: 'technical',
  environment: { latestAnswer: { text: 'I used MongoDB and PostgreSQL for different data needs.', tokenCount: 10 } },
  evaluatorState: { interactionStatus: 'usable', evidenceGainScore: 0.4 },
  interviewStructure: { focusAreaKey: 'technical', askedRootQuestionKeys: [] },
  matchState: { validationTargets: ['database'] },
  coverageState: { missingTopics: ['database'] },
  latestDecision: { selectionSource: 'rule_fallback', confidence: 0.8 },
};

describe('interviewer prepared pool runtime selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callDeepSeek.mockResolvedValue({ content: 'You mentioned databases. What database task did you own yourself?' });
  });

  it('selects from the prepared DB pool when available', async () => {
    mocks.getPreparedQuestionPool.mockResolvedValue([{
      questionId: 'prepared-db',
      status: 'active',
      topic: 'database',
      category: 'technical',
      stage: 'validation',
      sourceType: 'match_gap',
      sourceStage: 'match_gap',
      text: 'Tell me about one database task you handled yourself.',
      fallbackText: 'Tell me about one database task you handled yourself.',
      priorityWeight: 0.9,
      coverageWeight: 0.9,
      riskWeight: 0.9,
      modeCompatibility: { technical: true, behavioural: false, combined: true },
      evidenceNeed: ['ownership', 'validation_method'],
    }]);

    const result = await runInterviewerAgent({
      session: buildSession(),
      actionType: 'ASK_VALIDATION_QUESTION',
      decisionContext,
      targetTopic: 'database',
    });

    expect(result.preparedQuestionId).toBe('prepared-db');
    expect(result.questionDecision.selectionSource).toBe('prepared_question_pool');
    expect(result.questionDecision.rankTrace.questionId).toBe('prepared-db');
  });

  it('falls back to the legacy pool when the DB pool is empty', async () => {
    mocks.getPreparedQuestionPool.mockResolvedValue([]);

    const result = await runInterviewerAgent({
      session: buildSession(),
      actionType: 'ASK_POOL_QUESTION',
      decisionContext,
    });

    expect(result.preparedQuestionId).toBeNull();
    expect(result.nextQuestion).toEqual(expect.any(String));
    expect(result.questionDecision.selectionSource).not.toBe('prepared_question_pool');
  });

  it('falls back to the legacy pool when the DB query throws', async () => {
    mocks.getPreparedQuestionPool.mockRejectedValue(new Error('db down'));

    const result = await runInterviewerAgent({
      session: buildSession(),
      actionType: 'ASK_POOL_QUESTION',
      decisionContext,
    });

    expect(result.preparedQuestionId).toBeNull();
    expect(result.nextQuestion).toEqual(expect.any(String));
    expect(result.questionDecision.selectionSource).not.toBe('prepared_question_pool');
  });
});
