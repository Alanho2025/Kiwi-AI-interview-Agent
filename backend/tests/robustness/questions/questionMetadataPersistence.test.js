import { describe, expect, it } from 'vitest';

import * as masterAiService from '../../../src/services/masterAiService.js';
import { getNextQuestionOrder } from '../../../src/services/interviewStateService.js';
import { resolveFollowUpAssessmentContract } from '../../../src/services/questions/questionAssessmentContractService.js';

const { shouldMarkPreparedRootQuestionAsked } = masterAiService;

describe('question metadata persistence guards', () => {
  it.each([
    ['validation', ['validationVerification', 'outcomeValue']],
    ['technical_depth', ['approach', 'validationVerification']],
    ['tradeoff', ['judgementTradeoffs', 'validationVerification']],
    ['constraint', ['judgementTradeoffs', 'riskQualityEthics']],
    ['failure', ['approach', 'outcomeValue']],
  ])('maps %s follow-ups to role-specific assessment', (intent, targetedDimensions) => {
    expect(resolveFollowUpAssessmentContract({
      intent,
      parentQuestionFamily: 'motivation',
    })).toMatchObject({
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      targetedDimensions,
    });
  });

  it('keeps a behavioural result follow-up targeted to the result dimension', () => {
    expect(resolveFollowUpAssessmentContract({
      intent: 'result',
      parentQuestionFamily: 'behavioural',
    })).toMatchObject({
      questionFamily: 'behavioural',
      evidenceMode: 'past_example',
      targetedDimensions: ['resultOrReaction'],
    });
  });

  it('marks prepared pool items asked only for root questions', () => {
    expect(shouldMarkPreparedRootQuestionAsked({
      interviewerOutput: {
        turnKind: 'root_question',
        preparedQuestionId: 'prepared-root-1',
      },
    })).toBe(true);

    expect(shouldMarkPreparedRootQuestionAsked({
      interviewerOutput: {
        turnKind: 'follow_up',
        preparedQuestionId: 'prepared-root-1',
        parentPreparedQuestionId: 'prepared-root-1',
      },
    })).toBe(false);

    expect(shouldMarkPreparedRootQuestionAsked({
      interviewerOutput: {
        questionDecision: {
          turnKind: 'follow_up',
          parentPreparedQuestionId: 'prepared-root-1',
        },
      },
    })).toBe(false);
  });

  it('builds transcript metadata with role assessment context', () => {
    const metadata = masterAiService.buildQuestionTranscriptMetadata?.({
      stage: 'role_requirement',
      topic: 'clinical safety',
      questionType: 'validate_requirement',
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      roleDomain: 'healthcare',
      requirementCategory: 'compliance_or_safety',
      capabilityGroup: 'compliance_ethics_safety',
    });

    expect(metadata).toMatchObject({
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      roleDomain: 'healthcare',
      requirementCategory: 'compliance_or_safety',
      capabilityGroup: 'compliance_ethics_safety',
      turnType: 'interview_question',
      countsAsQuestion: true,
    });
  });

  it('preserves parent lineage separately from the current assessment contract', () => {
    const metadata = masterAiService.buildQuestionTranscriptMetadata?.({
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      parentQuestionFamily: 'motivation',
      parentEvidenceMode: 'knowledge_explanation',
      targetedDimensions: ['validationVerification', 'outcomeValue'],
    });

    expect(metadata).toMatchObject({
      questionFamily: 'role_specific',
      parentQuestionFamily: 'motivation',
      parentEvidenceMode: 'knowledge_explanation',
      targetedDimensions: ['validationVerification', 'outcomeValue'],
    });
  });

  it('classifies repair prompts as non-countable and keeps their parent question order', () => {
    const metadata = masterAiService.buildQuestionTranscriptMetadata({
      turnKind: 'repair',
      scenario: 'rephrase',
      parentQuestionId: 'question-3',
      text: 'Let me rephrase that question.',
    });

    expect(metadata).toMatchObject({
      turnType: 'repair_prompt',
      countsAsQuestion: false,
      parentQuestionId: 'question-3',
    });
    expect(masterAiService.shouldPersistInterviewQuestion({ interviewerOutput: {
      turnKind: 'repair',
      scenario: 'rephrase',
    } })).toBe(false);
    expect(getNextQuestionOrder({ currentQuestionIndex: 3 }, { countsAsQuestion: false })).toBe(3);
  });

  it('reports a diagnostic warning when prepared asked-state reconciliation misses its row', () => {
    expect(masterAiService.buildPreparedQuestionStateDiagnostic({
      markResult: null,
      sessionId: 'session-1',
      preparedQuestionId: 'missing-question',
    })).toEqual({
      level: 'warning',
      code: 'prepared_question_asked_state_update_missed',
      sessionId: 'session-1',
      preparedQuestionId: 'missing-question',
    });
  });
});
