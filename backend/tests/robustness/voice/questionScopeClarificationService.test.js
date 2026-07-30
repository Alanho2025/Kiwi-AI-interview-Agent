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

  it('treats a scope-help request as non-scoring even when semantic prepared scope is unavailable', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion({ ambiguityMode: 'none' })] },
      candidateText: 'Should I focus on personal AI use or a project I built?',
    });

    expect(observation).toMatchObject({
      kind: 'clarification_request',
      intentType: 'ask_focus_or_scope',
      countsAsAnswer: false,
    });
  });

  it.each([
    [
      'Can you clarify and clear describe what are you asking? Because I think you mentioned quite long sentences and I cannot really follow.',
      'did_not_understand',
    ],
    ['Could you repeat the question', 'request_repeat'],
    ['Can you make the question shorter and simpler', 'request_shorter_question'],
    ['Could you rephrase that in a different way', 'request_rephrase'],
    ['What does that question mean', 'ask_question_meaning'],
    ['I did not understand what you are asking', 'did_not_understand'],
    ['Can you give me an example of the kind of answer you mean', 'ask_example_type'],
    ['Could you say that more slowly', 'request_slower_delivery'],
    ['What timeframe should the example come from', 'ask_timeframe'],
    ['Are you asking me to describe my own contribution', 'confirm_candidate_understanding'],
    ['That question is too complex and has too many parts', 'question_too_complex'],
    ['That question was too long and wordy', 'question_too_long'],
    ['The question feels too broad and ambiguous', 'question_too_ambiguous'],
    ['I am not sure how to answer that question', 'uncertain_help_request'],
  ])('recognizes general voice clarification without requiring an ambiguity-mode flag: %s', (candidateText, intentType) => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion({ ambiguityMode: 'none' })] },
      candidateText,
    });

    expect(observation).toMatchObject({
      kind: 'clarification_request',
      intentType,
      rootQuestionId: 'question-3',
      countsAsQuestion: false,
      countsAsAnswer: false,
    });
    expect(observation.responseText).toBeTruthy();
  });

  it('does not swallow a substantive answer that ends with a conversational check', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion({ ambiguityMode: 'none' })] },
      candidateText: 'I led the rollout, clarified the requirements with finance, tested the workflow, and measured the result. Is that what you mean?',
    });

    expect(observation).toMatchObject({ kind: 'none' });
  });

  it('does not mistake an answer about clarifying requirements for a clarification request', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion({ ambiguityMode: 'none' })] },
      candidateText: 'I clarified the requirements with the product manager before I designed the workflow.',
    });

    expect(observation).toMatchObject({ kind: 'none' });
  });

  it.each([
    'I do not know where to start, so I mapped the workflow, removed two bottlenecks, and reduced cycle time by 30 percent.',
    'The requirement was too broad, so I narrowed it to onboarding, delivered the new workflow, and measured the result.',
    'I could not follow the initial data lineage, so I mapped every source, tested the joins, and fixed the reporting gap.',
    'Can you clarify what conversion means? I treated it as completed checkout, built the metric, and reduced reporting errors by 20 percent.',
  ])('keeps mixed or clarification-like substantive content as an answer: %s', (candidateText) => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion({ ambiguityMode: 'none' })] },
      candidateText,
    });

    expect(observation).toMatchObject({
      kind: 'none',
      reason: 'substantive_answer_content',
    });
  });

  it('recovers a clarification request without scoring when the active root is unavailable', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [] },
      candidateText: 'Could you repeat the question?',
    });

    expect(observation).toMatchObject({
      kind: 'clarification_recovery',
      intentType: 'request_repeat',
      countsAsQuestion: false,
      countsAsAnswer: false,
      rootQuestionId: null,
      scopeResponseReason: 'active_root_question_unavailable',
    });
  });

  it('fails closed without an active root even when the candidate text looks substantive', () => {
    const observation = resolveQuestionScopeObservation({
      session: { transcript: [] },
      candidateText: 'I built the service and reduced latency by 40 percent.',
    });

    expect(observation).toMatchObject({
      kind: 'clarification_recovery',
      intentType: 'active_question_unavailable',
      countsAsQuestion: false,
      countsAsAnswer: false,
      rootQuestionId: null,
      scopeResponseReason: 'active_root_question_unavailable',
    });
  });

  it('uses distinct deterministic responses for shorter, complex, ambiguous, and meaning requests', () => {
    const candidates = [
      'Can you make the question shorter',
      'That question is too complex',
      'That question is too ambiguous',
      'What does that question mean',
    ];
    const responses = candidates.map((candidateText) => resolveQuestionScopeObservation({
      session: { transcript: [rootQuestion({ ambiguityMode: 'none' })] },
      candidateText,
    }).responseText);

    expect(new Set(responses).size).toBe(candidates.length);
    expect(responses[0]).not.toContain('How do you use AI?');
    expect(responses[1]).toContain('one part at a time');
    expect(responses[2]).toContain('State that scope');
    expect(responses[3]).toContain('It is asking for');
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

  it('offers a non-scoring skip after two prior clarification responses', () => {
    const transcript = [
      rootQuestion({ ambiguityMode: 'none' }),
      ...[1, 2].flatMap((index) => ([
        {
          role: 'user',
          text: `Clarification ${index}`,
          metadata: {
            turnType: QUESTION_SCOPE_TURN_TYPES.REQUEST,
            countsAsQuestion: false,
            countsAsAnswer: false,
            rootQuestionId: 'question-3',
          },
        },
        {
          role: 'ai',
          text: `Help response ${index}`,
          questionId: 'question-3',
          metadata: {
            turnType: QUESTION_SCOPE_TURN_TYPES.RESPONSE,
            countsAsQuestion: false,
            countsAsAnswer: false,
            rootQuestionId: 'question-3',
          },
        },
      ])),
    ];
    const observation = resolveQuestionScopeObservation({
      session: { transcript },
      candidateText: 'I still do not understand the question',
    });

    expect(observation).toMatchObject({
      kind: 'clarification_skip_offer',
      countsAsAnswer: false,
      scopeResponseReason: 'repeated_clarification_skip_offered',
    });
    expect(observation.responseText).toContain('skip this question');
  });

  it('moves to a fresh root after the candidate accepts the bounded skip offer', () => {
    const transcript = [
      rootQuestion({ ambiguityMode: 'none' }),
      ...[1, 2].map((index) => ({
        role: 'ai',
        text: `Help response ${index}`,
        questionId: 'question-3',
        metadata: {
          turnType: QUESTION_SCOPE_TURN_TYPES.RESPONSE,
          countsAsQuestion: false,
          countsAsAnswer: false,
          rootQuestionId: 'question-3',
        },
      })),
    ];
    const observation = resolveQuestionScopeObservation({
      session: {
        currentQuestionIndex: 1,
        totalQuestions: 3,
        transcript,
        interviewPlan: {
          questionPool: [
            { questionId: 'question-3', text: 'How do you use AI?', category: 'technical' },
            { questionId: 'question-4', text: 'Tell me about a delivery improvement.', category: 'behavioural' },
          ],
        },
      },
      candidateText: 'skip this question',
    });

    expect(observation).toMatchObject({
      kind: 'skip_question_request',
      nextRootQuestionId: 'question-4',
      countsAsAnswer: false,
      turnType: 'interview_question',
    });
    expect(observation.responseText).toContain('Tell me about a delivery improvement.');
  });

  it('sanitizes an unsafe legacy pool question before speaking it after skip', () => {
    const transcript = [
      rootQuestion({ ambiguityMode: 'none' }),
      ...[1, 2].map((index) => ({
        role: 'ai',
        text: `Help response ${index}`,
        questionId: 'question-3',
        metadata: {
          turnType: QUESTION_SCOPE_TURN_TYPES.RESPONSE,
          countsAsQuestion: false,
          countsAsAnswer: false,
          rootQuestionId: 'question-3',
        },
      })),
    ];
    const observation = resolveQuestionScopeObservation({
      session: {
        currentQuestionIndex: 1,
        totalQuestions: 3,
        transcript,
        interviewPlan: {
          questionPool: [
            { questionId: 'question-3', text: 'How do you use AI?', category: 'technical' },
            {
              questionId: 'question-4',
              text: 'I want to validate one possible gap around Limited direct evidence for communication skills. What evidence do you have for meeting the requirement?',
              category: 'behavioural',
            },
          ],
        },
      },
      candidateText: 'skip this question',
    });

    expect(observation).toMatchObject({
      kind: 'skip_question_request',
      nextRootQuestionId: 'question-4',
    });
    expect(observation.responseText).toContain('Can you give me one practical example');
    expect(observation.responseText).not.toMatch(/I want to validate|limited direct evidence/i);
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
      intentType: 'ask_focus_or_scope',
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
