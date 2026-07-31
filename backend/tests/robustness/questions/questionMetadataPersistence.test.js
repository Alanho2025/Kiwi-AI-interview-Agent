import { describe, expect, it, vi } from 'vitest';

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
      questionType: 'technical_evidence',
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

  it('persists safe catalog provenance without copying private interview context', () => {
    const metadata = masterAiService.buildQuestionTranscriptMetadata({
      questionFamily: 'ai_assisted_delivery',
      catalogQuestionId: 'ai_assisted_delivery',
      catalogVersion: '2026.1',
      coverageSlot: 'software_ai_workflow',
      selectionPolicy: { minAsked: 1, maxAsked: 1 },
      eligibilityReason: ['role_family:software', 'level:senior'],
      userId: 'must-not-persist',
      rawJobDescription: 'must-not-persist',
    });

    expect(metadata).toMatchObject({
      catalogQuestionId: 'ai_assisted_delivery',
      catalogVersion: '2026.1',
      coverageSlot: 'software_ai_workflow',
      selectionPolicy: { minAsked: 1, maxAsked: 1 },
      eligibilityReason: ['role_family:software', 'level:senior'],
    });
    expect(JSON.stringify(metadata)).not.toContain('must-not-persist');
  });

  it('attaches a bounded catalog coverage outcome when an interview completes early', async () => {
    const recordCoverageTrace = vi.fn();
    const completed = await masterAiService.attachCatalogCoverageToCompletion({
      session: {
        id: 'session-1',
        mode: 'voice',
        currentQuestionIndex: 5,
        questionLimit: 8,
        settings: { seniorityLevel: 'Senior', questionLimit: 8 },
        analysisResult: {
          jobTitle: 'Senior Software Engineer',
          parsedJdProfile: { roleFamily: 'software_development' },
        },
        transcript: [],
      },
      result: {
        isComplete: true,
        completedBecause: 'time_limit_reached',
        nextQuestion: null,
      },
      loadPool: async () => [{
        questionId: 'catalog-ai-workflow',
        catalogQuestionId: 'ai_assisted_delivery',
        catalogLifecycle: 'approved',
        questionFamily: 'ai_assisted_delivery',
        coverageSlot: 'software_ai_workflow',
        selectionPolicy: { minAsked: 1, maxAsked: 1, reservationPriority: 90 },
      }],
      recordCoverageTrace,
    });

    expect(completed).toEqual(expect.objectContaining({
      catalogCoverage: expect.objectContaining({
        status: 'coverage_degraded',
        completedBecause: 'time_limit_reached',
        requiredCoverageCount: 1,
        degradedCoverageCount: 1,
      }),
    }));
    expect(completed.catalogCoverage).not.toHaveProperty('reservations');
    expect(recordCoverageTrace).toHaveBeenCalledWith(expect.objectContaining({
      status: 'coverage_degraded',
      reservations: [
        expect.objectContaining({ coverageSlot: 'software_ai_workflow', status: 'degraded' }),
      ],
    }));
  });

  it('does not load catalog coverage for text interview completion', async () => {
    const loadPool = vi.fn();
    const result = { isComplete: true, completedBecause: 'question_limit_reached' };

    await expect(masterAiService.attachCatalogCoverageToCompletion({
      session: { id: 'session-1', mode: 'text' },
      result,
      loadPool,
    })).resolves.toEqual(result);
    expect(loadPool).not.toHaveBeenCalled();
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

  it('classifies semantic scope clarification as its own non-countable turn type', () => {
    const metadata = masterAiService.buildQuestionTranscriptMetadata({
      questionType: 'question_scope_clarification',
      turnKind: 'repair',
      scenario: 'question_scope_clarification',
      parentQuestionId: 'question-3',
      clarificationContextVersion: 'scope-2026.2-v1',
      text: 'Please focus on one AI-assisted project.',
    });

    expect(metadata).toMatchObject({
      turnType: 'question_scope_clarification',
      countsAsQuestion: false,
      parentQuestionId: 'question-3',
      clarificationContextVersion: 'scope-2026.2-v1',
    });
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
