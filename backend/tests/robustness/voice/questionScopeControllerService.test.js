import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendTranscriptTurn: vi.fn(),
  createInterviewQuestion: vi.fn(),
  updateLatestTranscriptTurnMetadata: vi.fn(),
  markQuestionPoolItemAsked: vi.fn(),
  loggerWarn: vi.fn(),
  enqueueBackgroundJob: vi.fn(),
  recordAgentTraceEvent: vi.fn(),
  backgroundJobs: [],
}));

vi.mock('../../../src/services/sessionService.js', () => ({
  appendTranscriptTurn: mocks.appendTranscriptTurn,
  createInterviewQuestion: mocks.createInterviewQuestion,
  updateLatestTranscriptTurnMetadata: mocks.updateLatestTranscriptTurnMetadata,
}));
vi.mock('../../../src/services/questions/questionPoolComposerService.js', () => ({
  markQuestionPoolItemAsked: mocks.markQuestionPoolItemAsked,
}));

vi.mock('../../../src/jobs/backgroundJobQueue.js', () => ({
  enqueueBackgroundJob: mocks.enqueueBackgroundJob,
}));

vi.mock('../../../src/services/aiControl/agentTraceService.js', () => ({
  recordAgentTraceEvent: mocks.recordAgentTraceEvent,
}));
vi.mock('../../../src/utils/logger.js', () => ({
  logger: { warn: mocks.loggerWarn },
}));

const {
  executeQuestionScopeControllerTurn,
  persistExplicitAssumptionFraming,
} = await import('../../../src/services/voice/questionScopeControllerService.js');

const validObservation = () => ({
  kind: 'scope_request',
  actionType: 'ANSWER_QUESTION_SCOPE',
  turnType: 'question_scope_clarification',
  responseText: 'Focus on the business workflow and state the main constraint you would validate first.',
  rootQuestionId: 'root-question-7',
  parentQuestionId: 'root-question-7',
  preparedQuestionId: 'prepared-question-7',
  catalogQuestionId: 'catalog-question-7',
  ambiguityMode: 'open_scope_probe',
  clarificationContextVersion: 'scope-context-2026.2',
  scopeResponseReason: 'candidate_requested_focus',
  stage: 'technical',
  topic: 'ai_delivery',
  questionCategory: 'ai',
});

const flushBackgroundJobs = async () => {
  await Promise.all(mocks.backgroundJobs.splice(0));
};

describe('question scope controller persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.backgroundJobs = [];
    mocks.appendTranscriptTurn.mockResolvedValue(null);
    mocks.createInterviewQuestion.mockResolvedValue('persisted-question-8');
    mocks.updateLatestTranscriptTurnMetadata.mockResolvedValue(null);
    mocks.markQuestionPoolItemAsked.mockResolvedValue({ questionId: 'root-question-8' });
    mocks.enqueueBackgroundJob.mockImplementation((_name, job) => {
      const promise = Promise.resolve().then(() => job?.());
      mocks.backgroundJobs.push(promise);
      return promise;
    });
    mocks.recordAgentTraceEvent.mockResolvedValue(null);
  });

  it('answers with prepared context while preserving the active root and count', async () => {
    const onSentence = vi.fn();
    const harnessObserver = vi.fn();
    const observation = validObservation();

    const result = await executeQuestionScopeControllerTurn({
      session: {
        id: 'voice-session-1',
        currentQuestionIndex: 7,
      },
      observation,
      onSentence,
      workflowRunId: 'workflow-run-1',
      harnessObserver,
    });
    await flushBackgroundJobs();

    expect(result).toMatchObject({
      controllerAction: 'ANSWER_QUESTION_SCOPE',
      turnType: 'question_scope_clarification',
      rootQuestionId: 'root-question-7',
      nextQuestionOrder: 7,
      isComplete: false,
    });
    expect(onSentence).toHaveBeenCalledWith(observation.responseText, 0);
    expect(mocks.updateLatestTranscriptTurnMetadata).toHaveBeenCalledWith(
      'voice-session-1',
      'user',
      expect.objectContaining({
        turnType: 'question_scope_clarification_request',
        countsAsQuestion: false,
        countsAsAnswer: false,
        rootQuestionId: 'root-question-7',
      }),
    );
    expect(mocks.appendTranscriptTurn).toHaveBeenCalledWith(
      'voice-session-1',
      expect.objectContaining({
        role: 'ai',
        questionId: 'root-question-7',
        metadata: expect.objectContaining({
          turnType: 'question_scope_clarification',
          countsAsQuestion: false,
          countsAsAnswer: false,
          rootQuestionId: 'root-question-7',
        }),
      }),
    );
    expect(harnessObserver).toHaveBeenCalledWith(expect.objectContaining({
      plan: expect.objectContaining({
        selectedAction: 'ANSWER_QUESTION_SCOPE',
        candidateActions: [{ action: 'ANSWER_QUESTION_SCOPE', confidence: 1 }],
      }),
    }));
    expect(mocks.recordAgentTraceEvent).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'voice-session-1',
      workflowRunId: 'workflow-run-1',
      eventType: 'question_scope_clarification',
      payload: {
        selectedAction: 'ANSWER_QUESTION_SCOPE',
        intentType: null,
        scopeResponseReason: 'candidate_requested_focus',
        clarificationContextVersion: 'scope-context-2026.2',
        rootQuestionRef: 'root-question-7',
        countsAsQuestion: false,
        countsAsAnswer: false,
      },
    }));
    const tracePayload = mocks.recordAgentTraceEvent.mock.calls[0][0].payload;
    expect(tracePayload).not.toHaveProperty('responseText');
    expect(tracePayload).not.toHaveProperty('candidateText');
  });

  it('marks a substantive explicit assumption as a normal countable answer', async () => {
    await persistExplicitAssumptionFraming({
      sessionId: 'voice-session-1',
      observation: {
        ...validObservation(),
        kind: 'explicit_assumption',
      },
    });

    expect(mocks.updateLatestTranscriptTurnMetadata).toHaveBeenCalledWith(
      'voice-session-1',
      'user',
      {
        scopeFraming: 'explicit_assumption',
        rootQuestionId: 'root-question-7',
        preparedQuestionId: 'prepared-question-7',
        catalogQuestionId: 'catalog-question-7',
        ambiguityMode: 'open_scope_probe',
        countsAsAnswer: true,
      },
    );
    expect(mocks.appendTranscriptTurn).not.toHaveBeenCalled();
  });

  it('persists an accepted skip as a non-answer and the fresh root as a countable question', async () => {
    const observation = {
      ...validObservation(),
      kind: 'skip_question_request',
      actionType: 'SWITCH_TOPIC',
      requestTurnType: 'question_skip_request',
      turnType: 'interview_question',
      responseText: 'Okay, we’ll skip that one. Tell me about a delivery improvement.',
      scopeResponseReason: 'candidate_skipped_after_bounded_help',
      nextRootQuestionId: 'root-question-8',
      nextQuestion: {
        questionId: 'root-question-8',
        text: 'Tell me about a delivery improvement.',
        category: 'behavioural',
        stage: 'behavioural',
      },
    };

    const result = await executeQuestionScopeControllerTurn({
      session: {
        id: 'voice-session-1',
        currentQuestionIndex: 7,
        transcript: [],
      },
      observation,
    });

    expect(result).toMatchObject({
      turnKind: 'root_question',
      turnType: 'interview_question',
      rootQuestionId: 'root-question-8',
      controllerAction: 'SWITCH_TOPIC',
    });
    expect(mocks.updateLatestTranscriptTurnMetadata).toHaveBeenCalledWith(
      'voice-session-1',
      'user',
      expect.objectContaining({
        turnType: 'question_skip_request',
        countsAsAnswer: false,
        rootQuestionId: 'root-question-7',
      }),
    );
    expect(mocks.appendTranscriptTurn).toHaveBeenCalledWith(
      'voice-session-1',
      expect.objectContaining({
        questionId: 'persisted-question-8',
        metadata: expect.objectContaining({
          turnKind: 'root_question',
          turnType: 'interview_question',
          countsAsQuestion: true,
          countsAsAnswer: false,
          rootQuestionId: 'root-question-8',
        }),
      }),
    );
    expect(mocks.createInterviewQuestion).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'voice-session-1',
      questionOrder: 8,
      questionText: observation.responseText,
    }));
    expect(mocks.markQuestionPoolItemAsked).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'voice-session-1',
      questionId: 'root-question-8',
      askedTurnIndex: 8,
    }));
  });
});
