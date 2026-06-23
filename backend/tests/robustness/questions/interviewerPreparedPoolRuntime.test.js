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
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      roleDomain: 'professional_services',
      requirementCategory: 'domain_knowledge',
      capabilityGroup: 'domain_knowledge',
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
    expect(result.questionDecision.turnKind).toBe('root_question');
    expect(result.questionDecision.scenario).toBe('root_match_gap');
    expect(result.questionDecision.topRootCandidates).toHaveLength(1);
    expect(result).toMatchObject({
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      roleDomain: 'professional_services',
      requirementCategory: 'domain_knowledge',
      capabilityGroup: 'domain_knowledge',
    });
  });

  it('uses the prepared pool ranker instead of a simplified priority sort', async () => {
    mocks.getPreparedQuestionPool.mockResolvedValue([
      {
        questionId: 'priority-only',
        status: 'active',
        topic: 'unrelated',
        category: 'technical',
        stage: 'technical',
        sourceType: 'cv_skill',
        sourceStage: 'cv_seed',
        text: 'Tell me about unrelated work.',
        fallbackText: 'Tell me about unrelated work.',
        priorityWeight: 1,
        coverageWeight: 0.1,
        riskWeight: 0.1,
        modeCompatibility: { technical: true, combined: true },
      },
      {
        questionId: 'ranker-fit',
        status: 'active',
        topic: 'database',
        category: 'technical',
        stage: 'validation',
        sourceType: 'match_gap',
        sourceStage: 'match_gap',
        text: 'Tell me about one database validation task.',
        fallbackText: 'Tell me about one database validation task.',
        priorityWeight: 0.8,
        coverageWeight: 0.9,
        riskWeight: 0.9,
        modeCompatibility: { technical: true, combined: true },
      },
    ]);

    const result = await runInterviewerAgent({
      session: buildSession(),
      actionType: 'ASK_VALIDATION_QUESTION',
      decisionContext,
      targetTopic: 'database',
    });

    expect(result.preparedQuestionId).toBe('ranker-fit');
    expect(result.questionDecision.rankTrace.reasons).toEqual(expect.arrayContaining(['matches_missing_or_validation_target']));
  });

  it('stores bounded micro-planning metadata when the model returns valid JSON', async () => {
    mocks.callDeepSeek.mockResolvedValueOnce({
      content: JSON.stringify({
        selectedAngle: 'database validation',
        shortReason: 'The selected root target checks the database gap.',
        finalSpokenQuestion: 'How did you validate the database decision yourself?',
        evidenceUsed: ['match_gap:database'],
        riskFlags: [],
      }),
    });
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
      modeCompatibility: { technical: true, combined: true },
    }]);

    const result = await runInterviewerAgent({
      session: buildSession(),
      actionType: 'ASK_VALIDATION_QUESTION',
      decisionContext,
      targetTopic: 'database',
    });

    expect(result.displayText).toBe('How did you validate the database decision yourself?');
    expect(result.questionDecision).toEqual(expect.objectContaining({
      selectedAngle: 'database validation',
      shortReason: 'The selected root target checks the database gap.',
      microPlanEvidenceUsed: ['match_gap:database'],
      riskFlags: [],
      latency: expect.objectContaining({
        answerSignalBuildMs: expect.any(Number),
        rootCandidateRankMs: expect.any(Number),
        orchestratorDecisionMs: expect.any(Number),
        llmCompleteMs: expect.any(Number),
      }),
    }));
  });

  it('blocks a model-naturalized duplicate before streaming and uses the novel base question', async () => {
    const repeatedQuestion = 'Tell me about a time you showed ownership. What was the situation, what did you do, and what changed afterwards?';
    const novelBaseQuestion = 'Tell me about documentation you improved and the result it produced?';
    const onSentence = vi.fn();
    mocks.callDeepSeek.mockResolvedValueOnce({
      content: JSON.stringify({
        selectedAngle: 'ownership',
        shortReason: 'Model drifted to a previous question.',
        finalSpokenQuestion: repeatedQuestion,
        evidenceUsed: [],
        riskFlags: [],
      }),
    });
    mocks.getPreparedQuestionPool.mockResolvedValue([{
      questionId: 'prepared-documentation',
      status: 'active',
      topic: 'documentation',
      category: 'behavioural',
      questionFamily: 'behavioural',
      sourceType: 'cv_behavioural',
      sourceStage: 'cv_seed',
      text: novelBaseQuestion,
      fallbackText: novelBaseQuestion,
      priorityWeight: 0.9,
      coverageWeight: 0.8,
      riskWeight: 0.4,
      modeCompatibility: { behavioural: true, combined: true },
    }]);

    const result = await runInterviewerAgent({
      session: {
        ...buildSession(),
        settings: { focusArea: 'Combined' },
        transcript: [
          {
            role: 'ai',
            questionId: 'ownership-root',
            text: repeatedQuestion,
            metadata: {
              topic: 'ownership',
              questionFamily: 'behavioural',
              turnKind: 'root_question',
              turnType: 'interview_question',
              countsAsQuestion: true,
            },
          },
          { role: 'user', text: 'I owned the UI work and improved the result.' },
        ],
      },
      actionType: 'ASK_POOL_QUESTION',
      decisionContext: {
        ...decisionContext,
        currentTopic: 'documentation',
        interviewStructure: { focusAreaKey: 'combined', askedRootQuestionKeys: [] },
        matchState: { validationTargets: [] },
        coverageState: { missingTopics: ['documentation'] },
        environment: { latestAnswer: { text: 'I owned the UI work and improved the result.', tokenCount: 10 } },
      },
      targetTopic: 'documentation',
      onSentence,
    });

    expect(result.displayText).toBe(novelBaseQuestion);
    expect(onSentence).toHaveBeenCalledWith(novelBaseQuestion, 0);
    expect(result.questionDecision.deduplication).toEqual(expect.objectContaining({
      modelOutputRejected: true,
      reason: expect.stringMatching(/duplicate/),
      rejectedCandidates: [],
    }));
  });

  it('uses the next ranked base question when both final and base wording conflict', async () => {
    const onSentence = vi.fn();
    mocks.callDeepSeek.mockResolvedValueOnce({
      content: JSON.stringify({
        selectedAngle: 'ownership',
        shortReason: 'This wording conflicts with history.',
        finalSpokenQuestion: 'Tell me about a time you showed ownership?',
        evidenceUsed: [],
        riskFlags: [],
      }),
    });
    mocks.getPreparedQuestionPool.mockResolvedValue([
      {
        questionId: 'mislabelled-ownership',
        assessmentKey: 'root:unique-controller-goal:role_specific',
        status: 'active',
        topic: 'ownership',
        category: 'technical',
        questionFamily: 'role_specific',
        sourceStage: 'match_gap',
        text: 'What did you personally own in that delivery?',
        fallbackText: 'What did you personally own in that delivery?',
        priorityWeight: 1,
        coverageWeight: 1,
        riskWeight: 1,
        modeCompatibility: { technical: true, combined: true },
      },
      {
        questionId: 'prepared-documentation',
        status: 'active',
        topic: 'documentation',
        category: 'technical',
        questionFamily: 'role_specific',
        sourceStage: 'cv_seed',
        text: 'How did you improve documentation for the team?',
        fallbackText: 'How did you improve documentation for the team?',
        priorityWeight: 0.1,
        coverageWeight: 0.1,
        riskWeight: 0.1,
        modeCompatibility: { technical: true, combined: true },
      },
    ]);

    const result = await runInterviewerAgent({
      session: {
        ...buildSession(),
        transcript: [{
          role: 'ai',
          questionId: 'ownership-root',
          text: 'Tell me about a time you showed ownership?',
          metadata: {
            topic: 'ownership',
            questionFamily: 'role_specific',
            turnKind: 'root_question',
            countsAsQuestion: true,
          },
        }, { role: 'user', text: 'I owned the delivery.' }],
      },
      actionType: 'ASK_POOL_QUESTION',
      targetTopic: 'ownership',
      decisionContext: {
        ...decisionContext,
        currentTopic: 'ownership',
        coverageState: { missingTopics: ['ownership', 'documentation'] },
      },
      onSentence,
    });

    expect(result.preparedQuestionId).toBe('prepared-documentation');
    expect(result.displayText).toBe('How did you improve documentation for the team?');
    expect(onSentence).toHaveBeenCalledTimes(1);
    expect(mocks.callDeepSeek).toHaveBeenCalledTimes(1);
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

  it('does not consume a prepared root item for a follow-up turn', async () => {
    mocks.getPreparedQuestionPool.mockResolvedValue([{
      questionId: 'prepared-root',
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
      modeCompatibility: { technical: true, combined: true },
      evidenceNeed: ['ownership', 'validation_method'],
    }]);

    const result = await runInterviewerAgent({
      session: {
        ...buildSession(),
        transcript: [
          {
            role: 'ai',
            questionId: 'parent-q',
            text: 'Tell me about your database work.',
            metadata: {
              topic: 'database',
              followUpDepth: 0,
              questionFamily: 'role_specific',
              evidenceMode: 'knowledge_explanation',
              roleDomain: 'professional_services',
              requirementCategory: 'domain_knowledge',
              capabilityGroup: 'domain_knowledge',
              questionDecision: { preparedQuestionId: 'prepared-root' },
            },
          },
          { role: 'user', text: 'I helped with MongoDB and PostgreSQL but did not explain validation.' },
        ],
      },
      actionType: 'ASK_DEEP_DIVE_QUESTION',
      decisionContext,
      targetTopic: 'database',
    });

    expect(result.turnKind).toBe('follow_up');
    expect(result.preparedQuestionId).toBeNull();
    expect(result.questionDecision.preparedQuestionId).toBeUndefined();
    expect(result.parentQuestionId).toBe('parent-q');
    expect(result.parentPreparedQuestionId).toBe('prepared-root');
    expect(result.followUpDepth).toBe(1);
    expect(result.followUpIntent).toEqual(expect.any(String));
    expect(result).toMatchObject({
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      parentQuestionFamily: 'role_specific',
      parentEvidenceMode: 'knowledge_explanation',
      roleDomain: 'professional_services',
      requirementCategory: 'domain_knowledge',
      capabilityGroup: 'domain_knowledge',
    });
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
