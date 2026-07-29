import { describe, expect, it } from 'vitest';

import { evaluateTurnClarificationCoaching } from '../../../src/services/report/clarificationCoachingEvaluatorService.js';
import { evaluateTurnAiJudgementCoaching } from '../../../src/services/report/aiJudgementCoachingEvaluatorService.js';
import { buildAnswerAlignments } from '../../../src/services/report/answerAlignmentService.js';

describe('CP4 report clarification and AI judgement coaching evaluators', () => {
  it('evaluates scope_confirmed when a question_scope_clarification turn exists in transcript', () => {
    const questionTurn = {
      questionId: 'q-101',
      text: 'How do you use AI when building features?',
      metadata: { preparedQuestionId: 'prep-101', ambiguityMode: 'open_scope_probe' },
    };
    const answerTurn = {
      role: 'user',
      text: 'For my team, we use GitHub Copilot for code completion and unit tests.',
      metadata: { preparedQuestionId: 'prep-101' },
    };
    const transcript = [
      questionTurn,
      {
        role: 'ai',
        metadata: {
          turnType: 'question_scope_clarification',
          rootQuestionId: 'q-101',
        },
      },
      answerTurn,
    ];

    const result = evaluateTurnClarificationCoaching({
      questionTurn,
      answerTurn,
      transcript,
    });

    expect(result.clarificationStatus).toBe('scope_confirmed');
    expect(result.coachingFeedback).toContain('confirmed the question scope');
    expect(result.actionableTip).toContain('seeking scope confirmation');
  });

  it('evaluates explicit_assumption when candidate starts answer with an explicit assumption', () => {
    const questionTurn = {
      questionId: 'q-102',
      text: 'How would you build a search feature?',
      metadata: { preparedQuestionId: 'prep-102', ambiguityMode: 'bounded_scenario' },
    };
    const answerTurn = {
      role: 'user',
      text: 'I will assume this is for an enterprise e-commerce search service with high QPS requirements.',
      metadata: { preparedQuestionId: 'prep-102', scopeFraming: 'explicit_assumption' },
    };

    const result = evaluateTurnClarificationCoaching({
      questionTurn,
      answerTurn,
      transcript: [questionTurn, answerTurn],
    });

    expect(result.clarificationStatus).toBe('explicit_assumption');
    expect(result.coachingFeedback).toContain('stated your working assumption upfront');
  });

  it('evaluates no_assumption_stated when candidate answers an open scope question without confirming or stating assumptions', () => {
    const questionTurn = {
      questionId: 'q-103',
      text: 'How do you approach software delivery?',
      metadata: { preparedQuestionId: 'prep-103', ambiguityMode: 'open_scope_probe' },
    };
    const answerTurn = {
      role: 'user',
      text: 'I write unit tests and push code to main branch every day.',
      metadata: { preparedQuestionId: 'prep-103' },
    };

    const result = evaluateTurnClarificationCoaching({
      questionTurn,
      answerTurn,
      transcript: [questionTurn, answerTurn],
    });

    expect(result.clarificationStatus).toBe('no_assumption_stated');
    expect(result.coachingFeedback).toContain('stating your assumed context upfront makes your answer safer');
  });

  it('evaluates AI judgement coaching for AI/ML questions and detects verification methods', () => {
    const questionTurn = {
      questionId: 'q-104',
      text: 'How do you use AI when building features?',
      metadata: { preparedQuestionId: 'prep-104', questionType: 'ai_assisted_delivery' },
    };
    const answerTurnWithVerification = {
      role: 'user',
      text: 'I use GitHub Copilot to write code, but I always run unit tests and perform code review before merging.',
    };

    const verifiedResult = evaluateTurnAiJudgementCoaching({
      questionTurn,
      answerTurn: answerTurnWithVerification,
    });

    expect(verifiedResult.aiJudgementStatus).toBe('ai_workflow_verified');
    expect(verifiedResult.coachingFeedback).toContain('personal verification and workflow ownership');

    const answerTurnToolsOnly = {
      role: 'user',
      text: 'I use Copilot and Claude to code fast.',
    };

    const toolsOnlyResult = evaluateTurnAiJudgementCoaching({
      questionTurn,
      answerTurn: answerTurnToolsOnly,
    });

    expect(toolsOnlyResult.aiJudgementStatus).toBe('ai_tools_named_only');
    expect(toolsOnlyResult.coachingFeedback).toContain('referenced AI tools');
  });

  it('attaches CP4 clarification and AI judgement coaching to buildAnswerAlignments without distorting scores', () => {
    const interviewPlan = {
      questionPool: [
        {
          questionId: 'prep-105',
          text: 'How do you verify AI-generated code?',
          topic: 'ai_assisted_delivery',
          testedRoleIntentIds: ['ri-1'],
          expectedSignals: ['verification', 'ownership'],
        },
      ],
    };
    const analysisResult = {
      roleEvidenceMap: {
        items: [
          {
            roleIntentId: 'ri-1',
            roleIntent: 'Code verification',
            sourceEvidence: [{ evidenceId: 'ev-1', text: 'I write unit tests and code review all Copilot code.' }],
          },
        ],
      },
    };
    const questionAnswerPairs = [
      {
        questionId: 'q-105',
        questionTurn: {
          questionId: 'q-105',
          text: 'How do you verify AI-generated code?',
          metadata: { preparedQuestionId: 'prep-105', questionType: 'ai_assisted_delivery', ambiguityMode: 'open_scope_probe' },
        },
        answerTurn: {
          id: 'ans-105',
          role: 'user',
          text: 'I write unit tests and code review all Copilot code.',
          metadata: { preparedQuestionId: 'prep-105' },
        },
      },
    ];

    const alignments = buildAnswerAlignments({
      questionAnswerPairs,
      interviewPlan,
      analysisResult,
      session: { transcript: [] },
    });

    expect(alignments.length).toBe(1);
    expect(alignments[0].clarificationCoaching).toBeDefined();
    expect(alignments[0].clarificationCoaching.clarificationStatus).toBe('no_assumption_stated');
    expect(alignments[0].aiJudgementCoaching).toBeDefined();
    expect(alignments[0].aiJudgementCoaching.aiJudgementStatus).toBe('ai_workflow_verified');
  });
});
