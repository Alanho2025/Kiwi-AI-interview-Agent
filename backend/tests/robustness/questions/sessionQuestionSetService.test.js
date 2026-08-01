import { describe, expect, it, vi } from 'vitest';
import {
  buildSessionQuestionSet,
  buildQuestionTurnSlots,
  applySessionQuestionSetSelectionPolicy,
  buildAcceptedAnswerCoverageUpdates,
  buildQuestionSelectionDecision,
  canTransitionQuestionCoverage,
  persistSessionQuestionSet,
  recordSessionQuestionSelection,
  QUESTION_COVERAGE_STATUS,
  QUESTION_DECISION_TRACE_CONTRACT,
} from '../../../src/services/questions/sessionQuestionSetService.js';

const preparedItems = [
  {
    questionId: 'question-context',
    text: 'Tell me about your most relevant project.',
    category: 'opening',
    questionRole: 'root_question',
    assessmentKey: 'root:context:opening',
    questionFingerprint: 'fingerprint-context',
    expectedSignal: ['relevant_context'],
    status: 'asked',
    askedAt: new Date('2026-08-01T00:00:00.000Z'),
    rankTrace: { shouldNotPersist: true },
  },
  {
    questionId: 'question-api',
    text: 'Describe how you designed an API.',
    category: 'technical',
    questionRole: 'root_question',
    assessmentKey: 'root:api:technical',
    questionFingerprint: 'fingerprint-api',
    coverageContractIds: ['target-api-design'],
    expectedSignal: ['tradeoffs', 'validation'],
  },
];

const leanResult = (value) => ({ lean: async () => value });

describe('sessionQuestionSetService', () => {
  it('builds immutable turn, target, coverage, and bounded decision-trace contracts', () => {
    const questionSet = buildSessionQuestionSet({
      sessionId: 'session-1',
      userId: 'user-1',
      settings: { focusArea: 'Technical', questionLimit: 8, seniorityLevel: 'Senior' },
      items: preparedItems,
    });

    expect(questionSet.definition.turnSlots).toHaveLength(8);
    expect(questionSet.definition.turnSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({
        turn: 1,
        phase: 'warm_up',
        allowedQuestionKinds: ['root_question'],
        intendedPurpose: 'establish_candidate_context',
        policyReason: 'first_countable_turn_candidate_context',
      }),
      expect.objectContaining({
        turn: 2,
        phase: 'evidence_foundation',
        allowedQuestionKinds: ['root_question', 'follow_up'],
      }),
      expect.objectContaining({
        turn: 8,
        phase: 'closing',
        allowedQuestionKinds: ['root_question'],
        intendedPurpose: 'synthesize_and_close_interview',
      }),
    ]));
    expect(questionSet.definition.items[0]).toMatchObject({ status: 'active' });
    expect(questionSet.definition.items[0]).not.toHaveProperty('askedAt');
    expect(questionSet.definition.items[0]).not.toHaveProperty('rankTrace');
    expect(questionSet.definition.targetContracts['coverage_contract:target-api-design']).toMatchObject({
      questionIds: ['question-api'],
      expectedSignals: ['tradeoffs', 'validation'],
    });
    expect(questionSet.runtimeState.coverageByTargetId['coverage_contract:target-api-design']).toEqual(expect.objectContaining({
      status: QUESTION_COVERAGE_STATUS.UNSEEN,
      reason: 'initialized_from_canonical_question_set',
    }));
    expect(questionSet.definition.decisionTraceContract).toEqual(QUESTION_DECISION_TRACE_CONTRACT);
  });

  it('makes question coverage transitions explicit and rejects arbitrary jumps', () => {
    expect(canTransitionQuestionCoverage({
      from: QUESTION_COVERAGE_STATUS.UNSEEN,
      to: QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED,
    })).toBe(true);
    expect(canTransitionQuestionCoverage({
      from: QUESTION_COVERAGE_STATUS.ANSWERED_WEAK,
      to: QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
    })).toBe(false);
    expect(canTransitionQuestionCoverage({
      from: QUESTION_COVERAGE_STATUS.NEEDS_FOLLOW_UP,
      to: QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
    })).toBe(true);
  });

  it('persists a question set exactly once and returns the concurrent winner', async () => {
    const createdQuestionSet = buildSessionQuestionSet({
      sessionId: 'session-1',
      userId: 'user-1',
      settings: { questionLimit: 8 },
      items: preparedItems,
    });
    const planModel = {
      findOneAndUpdate: vi.fn(() => leanResult(null)),
      findOne: vi.fn(() => leanResult({ sessionQuestionSet: createdQuestionSet })),
    };

    const result = await persistSessionQuestionSet({
      sessionId: 'session-1',
      userId: 'user-1',
      settings: { questionLimit: 8 },
      items: preparedItems,
      planModel,
    });

    expect(result).toEqual({ questionSet: createdQuestionSet, created: false });
    expect(planModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'session-1',
        userId: 'user-1',
        'sessionQuestionSet.definition.schemaVersion': { $exists: false },
      }),
      expect.objectContaining({ $set: expect.objectContaining({ sessionQuestionSet: expect.any(Object) }) }),
      { new: true },
    );
    expect(planModel.findOne).toHaveBeenCalledWith({ sessionId: 'session-1', userId: 'user-1' });
  });

  it('does not create a detached question set when its owning interview plan is missing', async () => {
    const planModel = {
      findOneAndUpdate: vi.fn(() => leanResult(null)),
      findOne: vi.fn(() => leanResult(null)),
    };

    const result = await persistSessionQuestionSet({
      sessionId: 'missing-session',
      userId: 'user-1',
      items: preparedItems,
      planModel,
    });

    expect(result).toEqual({ questionSet: null, created: false });
  });

  it('enforces slot phase and excludes root targets that are already covered or awaiting follow-up', () => {
    const questionSet = buildSessionQuestionSet({
      sessionId: 'session-1',
      userId: 'user-1',
      settings: { questionLimit: 4 },
      items: [
        ...preparedItems,
        {
          questionId: 'question-react',
          text: 'How did you use React and frontend testing?',
          topic: 'react frontend',
          category: 'technical',
          questionRole: 'root_question',
          coverageContractIds: ['target-react'],
          expectedSignal: ['react', 'frontend'],
        },
        {
          questionId: 'question-close',
          text: 'What questions do you have for us?',
          category: 'closing',
          questionRole: 'wrap_up',
        },
      ],
    });
    questionSet.runtimeState.coverageByTargetId['coverage_contract:target-api-design'].status = QUESTION_COVERAGE_STATUS.ANSWERED_STRONG;

    const warmUp = applySessionQuestionSetSelectionPolicy({
      questionSet,
      turn: 1,
      requestedTurnKind: 'follow_up',
      poolItems: questionSet.definition.items,
    });
    const core = applySessionQuestionSetSelectionPolicy({
      questionSet,
      turn: 2,
      poolItems: questionSet.definition.items,
    });
    const closing = applySessionQuestionSetSelectionPolicy({
      questionSet,
      turn: 4,
      poolItems: questionSet.definition.items,
    });

    expect(warmUp).toMatchObject({ turnKind: 'root_question', forcedRootQuestion: true });
    expect(warmUp.candidates.map((item) => item.questionId)).toEqual(['question-context']);
    expect(core.candidates.map((item) => item.questionId)).toEqual(['question-react']);
    expect(core.excludedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'question-api', reason: 'target_strong' }),
      expect.objectContaining({ questionId: 'question-context', reason: 'phase_ineligible' }),
      expect.objectContaining({ questionId: 'question-close', reason: 'phase_ineligible' }),
    ]));
    expect(closing.candidates.map((item) => item.questionId)).toEqual(['question-close']);
  });

  it('records accepted strong answer coverage for the asked target and conservatively covered sibling targets', () => {
    const questionSet = buildSessionQuestionSet({
      sessionId: 'session-1',
      userId: 'user-1',
      settings: { questionLimit: 4 },
      items: [
        ...preparedItems,
        {
          questionId: 'question-react',
          text: 'How did you use React and frontend testing?',
          topic: 'react frontend',
          category: 'technical',
          questionRole: 'root_question',
          coverageContractIds: ['target-react'],
          expectedSignal: ['react', 'frontend'],
        },
      ],
    });
    questionSet.runtimeState.coverageByTargetId['coverage_contract:target-api-design'].status = QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED;
    const updates = buildAcceptedAnswerCoverageUpdates({
      questionSet,
      transcript: [{
        role: 'ai',
        metadata: { preparedQuestionId: 'question-api', turnKind: 'root_question' },
      }],
      answerText: 'I designed the API for our React frontend, implemented the integration, and validated it with frontend tests before release.',
      evaluation: {
        evidenceStatus: 'EXACT_MATCH',
        evidenceGainScore: 0.82,
        successStatus: 'usable',
        misunderstandingFlag: false,
      },
    });

    expect(updates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        targetId: 'coverage_contract:target-api-design',
        fromStatus: QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED,
        toStatus: QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
        implicit: false,
      }),
      expect.objectContaining({
        targetId: 'coverage_contract:target-react',
        fromStatus: QUESTION_COVERAGE_STATUS.UNSEEN,
        toStatus: QUESTION_COVERAGE_STATUS.ANSWERED_STRONG,
        implicit: true,
      }),
    ]));
  });

  it('keeps partial and misunderstood answers out of strong sibling coverage', () => {
    const questionSet = buildSessionQuestionSet({
      sessionId: 'session-1',
      userId: 'user-1',
      settings: { questionLimit: 4 },
      items: preparedItems,
    });
    questionSet.runtimeState.coverageByTargetId['coverage_contract:target-api-design'].status = QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED;
    const transcript = [{ role: 'ai', metadata: { preparedQuestionId: 'question-api', turnKind: 'root_question' } }];
    const partialUpdates = buildAcceptedAnswerCoverageUpdates({
      questionSet,
      transcript,
      answerText: 'I have some API experience but need to provide more detail.',
      evaluation: {
        evidenceStatus: 'PARTIAL_TRANSFER',
        evidenceGainScore: 0.54,
        successStatus: 'weak',
        misunderstandingFlag: false,
      },
    });
    const misunderstoodUpdates = buildAcceptedAnswerCoverageUpdates({
      questionSet,
      transcript,
      answerText: 'Could you repeat what you mean by API design?',
      evaluation: {
        evidenceStatus: 'INSUFFICIENT_EVIDENCE',
        evidenceGainScore: 0.2,
        misunderstandingFlag: true,
      },
    });

    expect(partialUpdates).toEqual([
      expect.objectContaining({
        targetId: 'coverage_contract:target-api-design',
        toStatus: QUESTION_COVERAGE_STATUS.ANSWERED_PARTIAL,
        implicit: false,
      }),
    ]);
    expect(misunderstoodUpdates).toEqual([]);
  });

  it('writes one bounded decision trace and its asked-unconfirmed coverage transition with a revision check', async () => {
    const questionSet = buildSessionQuestionSet({
      sessionId: 'session-1',
      userId: 'user-1',
      settings: { questionLimit: 4 },
      items: preparedItems,
    });
    const plan = { sessionQuestionSet: questionSet };
    const planModel = {
      findOne: vi.fn(() => leanResult(plan)),
      findOneAndUpdate: vi.fn((_query, update) => {
        plan.sessionQuestionSet.runtimeState = update.$set['sessionQuestionSet.runtimeState'];
        return leanResult(plan);
      }),
    };
    const questionDecision = {
      preparedQuestionId: 'question-api',
      rankTrace: { score: 0.84, reasons: ['matches_missing_or_validation_target'] },
      topRootCandidates: [{ questionId: 'question-context', score: 0.4, rankTrace: { reasons: ['fresh_topic'] } }],
      rejectedCandidates: [{ questionId: 'question-context', reason: 'already_asked' }],
    };

    const decision = buildQuestionSelectionDecision({ questionSet, turn: 2, questionDecision });
    const stored = await recordSessionQuestionSelection({
      sessionId: 'session-1',
      userId: 'user-1',
      turn: 2,
      questionDecision,
      planModel,
    });

    expect(decision).toEqual(expect.objectContaining({
      turn: 2,
      phase: 'evidence_foundation',
      selectedQuestionId: 'question-api',
      targetId: 'coverage_contract:target-api-design',
      coverageBefore: 'unseen',
      coverageAfter: 'asked_unconfirmed',
      rankedCandidates: expect.arrayContaining([expect.objectContaining({ questionId: 'question-api', score: 0.84 })]),
      excludedCandidates: expect.arrayContaining([expect.objectContaining({ questionId: 'question-context', reason: 'already_asked' })]),
    }));
    expect(stored.runtimeState.revision).toBe(1);
    expect(stored.runtimeState.decisionsByTurn).toHaveLength(1);
    expect(stored.runtimeState.coverageByTargetId['coverage_contract:target-api-design']).toMatchObject({
      status: QUESTION_COVERAGE_STATUS.ASKED_UNCONFIRMED,
      lastQuestionId: 'question-api',
    });
    expect(planModel.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ 'sessionQuestionSet.runtimeState.revision': 0 }),
      expect.any(Object),
      { new: true },
    );
  });
});

describe('buildQuestionTurnSlots', () => {
  it('uses a deterministic progressive phase policy for each countable turn', () => {
    expect(buildQuestionTurnSlots({ settings: { questionLimit: 4 } })).toEqual([
      expect.objectContaining({ turn: 1, phase: 'warm_up' }),
      expect.objectContaining({ turn: 2, phase: 'evidence_foundation' }),
      expect.objectContaining({ turn: 3, phase: 'tradeoff_stress' }),
      expect.objectContaining({ turn: 4, phase: 'closing' }),
    ]);
  });
});
