import { describe, expect, it } from 'vitest';

import { AGENT_ACTION_TYPES } from '../../../src/constants/agentActionTypes.js';
import { buildQuestionScopeControllerOutput } from '../../../src/services/voice/questionScopeControllerService.js';
import {
  buildQuestionScopeTracePayload,
  QUESTION_SCOPE_TURN_TYPES,
  resolveQuestionScopeObservation,
} from '../../../src/services/voice/questionScopeClarificationService.js';

const rootQuestion = ({
  ambiguityMode = 'open_scope_probe',
  clarificationContextVersion = 'scope-2026.2-v1',
  clarificationResponseText = 'Please focus on how you used AI to deliver a project, including your process, checks, and the result.',
} = {}) => ({
  role: 'ai',
  text: 'How do you use AI?',
  questionId: 'question-3',
  metadata: {
    turnType: 'interview_question',
    countsAsQuestion: true,
    preparedQuestionId: 'pool-question-3',
    catalogQuestionId: 'ai_assisted_delivery',
    ambiguityMode,
    clarificationContextVersion,
    clarificationContext: clarificationResponseText
      ? { responseText: clarificationResponseText }
      : null,
  },
});

describe('voice question scope clarification policy', () => {
  it('answers a semantic scope question from versioned prepared context while keeping the root active', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion()] },
      candidateText: 'Would you like me to focus on how I use AI personally, or on an AI product I built?',
    });

    expect(observation).toMatchObject({
      kind: 'scope_request',
      actionType: AGENT_ACTION_TYPES.ANSWER_QUESTION_SCOPE,
      turnType: QUESTION_SCOPE_TURN_TYPES.RESPONSE,
      rootQuestionId: 'question-3',
      preparedQuestionId: 'pool-question-3',
      catalogQuestionId: 'ai_assisted_delivery',
      clarificationContextVersion: 'scope-2026.2-v1',
      scopeResponseReason: 'candidate_requested_focus',
      countsAsQuestion: false,
      countsAsAnswer: false,
    });
    expect(observation.responseText).toContain('used AI to deliver a project');
  });

  it('recognizes a scope request from voice text even when STT omits terminal punctuation', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion()] },
      candidateText: 'I am not sure whether you mean my personal AI use or a project I built',
    });

    expect(observation).toMatchObject({
      kind: 'scope_request',
      actionType: AGENT_ACTION_TYPES.ANSWER_QUESTION_SCOPE,
    });
  });

  it('fails closed when an eligible question has no versioned prepared response', () => {
    const observation = resolveQuestionScopeObservation({
      session: {
        transcript: [rootQuestion({
          clarificationContextVersion: null,
          clarificationResponseText: null,
        })],
      },
      candidateText: 'Do you mean my personal use of AI or a product I built?',
    });

    expect(observation).toMatchObject({
      kind: 'scope_request_degraded',
      actionType: AGENT_ACTION_TYPES.REPHRASE_QUESTION,
      turnType: 'repair_prompt',
      rootQuestionId: 'question-3',
      scopeResponseReason: 'prepared_context_unavailable',
      countsAsQuestion: false,
      countsAsAnswer: false,
    });
    expect(observation.responseText).not.toContain('product');
  });

  it('does not activate the CP3 lane for a question whose ambiguity mode is none', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion({ ambiguityMode: 'none' })] },
      candidateText: 'Should I focus on personal AI use or a project I built?',
    });

    expect(observation).toMatchObject({
      kind: 'none',
      reason: 'ambiguity_mode_none',
    });
  });

  it('accepts a substantive assumption-framed answer without manufacturing a clarification turn', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion()] },
      candidateText: "I'll assume you mean an internal workflow. I used an agent to plan the feature, write tests, review the diff, and verify the result with a human checkpoint.",
    });

    expect(observation).toMatchObject({
      kind: 'explicit_assumption',
      scopeFraming: 'explicit_assumption',
      rootQuestionId: 'question-3',
      countsAsAnswer: true,
    });
    expect(observation).not.toHaveProperty('responseText');
  });

  it('bounds repeated scope requests instead of creating a clarification loop', () => {
    const observation = resolveQuestionScopeObservation({
      session: {
        transcript: [
          rootQuestion(),
          {
            role: 'user',
            text: 'Do you mean personal use or project delivery?',
            metadata: {
              turnType: QUESTION_SCOPE_TURN_TYPES.REQUEST,
              countsAsQuestion: false,
              countsAsAnswer: false,
              rootQuestionId: 'question-3',
            },
          },
          {
            role: 'ai',
            text: 'Please focus on project delivery.',
            questionId: 'question-3',
            metadata: {
              turnType: QUESTION_SCOPE_TURN_TYPES.RESPONSE,
              countsAsQuestion: false,
              countsAsAnswer: false,
              rootQuestionId: 'question-3',
            },
          },
        ],
      },
      candidateText: 'I still do not know whether you mean personal use or a project. Which one?',
    });

    expect(observation).toMatchObject({
      kind: 'repeated_scope_request',
      actionType: AGENT_ACTION_TYPES.ASK_SCAFFOLD_QUESTION,
      rootQuestionId: 'question-3',
      countsAsQuestion: false,
      countsAsAnswer: false,
    });
  });

  it('ignores a normal answer that merely mentions focus', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion()] },
      candidateText: 'I focused on coding and debugging, then verified the generated tests before merging.',
    });

    expect(observation).toMatchObject({ kind: 'none' });
  });

  it('builds a non-countable controller result that resumes the same root and order', () => {
    const session = {
      currentQuestionIndex: 3,
      totalQuestions: 8,
      transcript: [rootQuestion()],
    };
    const observation = resolveQuestionScopeObservation({
      session,
      candidateText: 'Would you like me to focus on personal use or project delivery?',
    });

    expect(buildQuestionScopeControllerOutput({ session, observation })).toMatchObject({
      questionType: 'question_scope_clarification',
      turnKind: 'repair',
      turnType: QUESTION_SCOPE_TURN_TYPES.RESPONSE,
      rootQuestionId: 'question-3',
      preparedQuestionId: 'pool-question-3',
      nextQuestionOrder: 3,
      controllerAction: AGENT_ACTION_TYPES.ANSWER_QUESTION_SCOPE,
      isComplete: false,
    });
  });

  it('preserves a zero-based active question index without advancing it', () => {
    const result = buildQuestionScopeControllerOutput({
      session: {
        currentQuestionIndex: 0,
        transcript: [rootQuestion()],
      },
      observation: {
        ...resolveQuestionScopeObservation({
          session: { transcript: [rootQuestion()] },
          candidateText: 'Should I focus on personal use or project delivery?',
        }),
      },
    });

    expect(result.nextQuestionOrder).toBe(0);
  });

  it('builds a redacted trace payload without candidate text or prepared response content', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion()] },
      candidateText: 'Do you mean personal use or project delivery?',
    });
    const tracePayload = buildQuestionScopeTracePayload(observation);

    expect(tracePayload).toMatchObject({
      selectedAction: AGENT_ACTION_TYPES.ANSWER_QUESTION_SCOPE,
      scopeResponseReason: 'candidate_requested_focus',
      clarificationContextVersion: 'scope-2026.2-v1',
      rootQuestionRef: 'question-3',
      countsAsQuestion: false,
      countsAsAnswer: false,
    });
    expect(tracePayload).not.toHaveProperty('responseText');
    expect(JSON.stringify(tracePayload)).not.toContain('personal use');
  });
});
