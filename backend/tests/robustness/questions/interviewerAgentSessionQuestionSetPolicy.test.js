import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildInterviewTurnPlan: vi.fn(),
  getNextPoolQuestion: vi.fn(),
  callDeepSeek: vi.fn(),
}));

vi.mock('../../../src/services/questions/interviewTurnOrchestratorService.js', () => ({
  buildInterviewTurnPlan: mocks.buildInterviewTurnPlan,
}));

vi.mock('../../../src/services/interviewStateService.js', async () => {
  const actual = await vi.importActual('../../../src/services/interviewStateService.js');
  return {
    ...actual,
    getNextPoolQuestion: mocks.getNextPoolQuestion,
  };
});

vi.mock('../../../src/services/deepseekService.js', () => ({
  callDeepSeek: mocks.callDeepSeek,
  callDeepSeekStream: vi.fn(),
}));

const { runInterviewerAgent } = await import('../../../src/services/agents/interviewerAgent.js');

const session = {
  id: 'session-1',
  userId: 'user-1',
  currentQuestionIndex: 1,
  totalQuestions: 4,
  settings: { focusArea: 'Combined' },
  transcript: [{ role: 'user', text: 'I worked on an API migration.' }],
};

const decisionContext = {
  environment: { latestAnswer: { text: 'I worked on an API migration.', tokenCount: 6 } },
  evaluatorState: { interactionStatus: 'usable', evidenceGainScore: 0.4 },
  interviewStructure: { focusAreaKey: 'combined', nextTurnIndex: 4 },
};

const closingTurnPlan = (selectedRootCandidate = null) => ({
  turnKind: 'root_question',
  turnSlot: {
    turn: 4,
    phase: 'closing',
    allowedQuestionKinds: ['root_question'],
    intendedPurpose: 'synthesize_and_close_interview',
    policyReason: 'final_countable_turn_reserves_candidate_wrap_up',
  },
  selectedRootCandidate,
  alternativeRootCandidates: [],
  planningFrame: {},
  scenario: 'root_wrap_up',
  sourcePolicy: 'prepared_root_pool',
  evidencePackage: null,
  topRootCandidates: selectedRootCandidate ? [selectedRootCandidate] : [],
  rejectedCandidates: [],
  poolDegraded: false,
  poolDegradedReason: null,
  followUpContext: null,
  followUpIntent: null,
  evidenceTarget: null,
  followUpComparison: null,
  latency: {},
});

const warmUpTurnPlan = (selectedRootCandidate) => ({
  ...closingTurnPlan(selectedRootCandidate),
  turnSlot: {
    turn: 1,
    phase: 'warm_up',
    allowedQuestionKinds: ['root_question'],
    intendedPurpose: 'establish_candidate_context',
    policyReason: 'first_countable_turn_candidate_context',
  },
  scenario: 'root_cv_evidence',
});

describe('interviewer agent session-question-set root-only slots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.callDeepSeek.mockResolvedValue({ content: 'What questions do you have for us?' });
  });

  it('does not fall back to a legacy question or a probing action when a required closing root is unavailable', async () => {
    mocks.buildInterviewTurnPlan.mockResolvedValue(closingTurnPlan());
    mocks.getNextPoolQuestion.mockReturnValue({
      text: 'Legacy technical question that must not be asked.',
      category: 'technical',
    });

    const result = await runInterviewerAgent({
      session,
      actionType: 'ASK_DEEP_DIVE_QUESTION',
      decisionContext,
    });

    expect(result).toMatchObject({
      isComplete: true,
      completedBecause: 'required_phase_candidate_unavailable',
      nextQuestion: null,
      questionDecision: expect.objectContaining({ phase: 'closing' }),
    });
    expect(mocks.getNextPoolQuestion).not.toHaveBeenCalled();
  });

  it('keeps a selected closing root even when the controller requested a probing action', async () => {
    mocks.buildInterviewTurnPlan.mockResolvedValue(closingTurnPlan({
      questionId: 'prepared-closing',
      text: 'What questions do you have for us?',
      category: 'closing',
      sourceStage: 'wrap_up',
      sourceType: 'prepared_question_pool',
      questionIntent: 'wrap_up',
    }));

    const result = await runInterviewerAgent({
      session,
      actionType: 'ASK_DEEP_DIVE_QUESTION',
      decisionContext,
    });

    expect(result).toMatchObject({
      preparedQuestionId: 'prepared-closing',
      turnKind: 'root_question',
      nextQuestion: 'What questions do you have for us?',
    });
    expect(result.nextQuestion).not.toMatch(/technical approach|walk me through/i);
    expect(mocks.getNextPoolQuestion).not.toHaveBeenCalled();
  });

  it('keeps a behavioural self-introduction root in a technical warm-up slot', async () => {
    mocks.buildInterviewTurnPlan.mockResolvedValue(warmUpTurnPlan({
      questionId: 'prepared-warm-up',
      text: 'Please introduce the experience most relevant to this role.',
      category: 'behavioural',
      sourceStage: 'opening',
      sourceType: 'prepared_question_pool',
      questionFamily: 'self_intro',
      questionIntent: 'self_intro',
    }));

    const result = await runInterviewerAgent({
      session: { ...session, settings: { focusArea: 'Technical' } },
      actionType: 'ASK_DEEP_DIVE_QUESTION',
      decisionContext: {
        ...decisionContext,
        interviewStructure: { focusAreaKey: 'technical', nextTurnIndex: 1 },
      },
    });

    expect(result).toMatchObject({
      preparedQuestionId: 'prepared-warm-up',
      turnKind: 'root_question',
      nextQuestion: 'Please introduce the experience most relevant to this role.',
    });
    expect(result.nextQuestion).not.toMatch(/technical approach|implementation/i);
    expect(mocks.getNextPoolQuestion).not.toHaveBeenCalled();
  });
});
