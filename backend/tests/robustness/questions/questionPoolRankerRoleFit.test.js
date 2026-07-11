import { describe, expect, it } from 'vitest';
import { rankPreparedQuestionPool } from '../../../src/services/questions/questionPoolRankerService.js';

describe('questionPoolRankerService - Role-Fit integration', () => {
  const poolItems = [
    {
      questionId: 'q-react',
      status: 'active',
      topic: 'react',
      category: 'technical',
      sourceType: 'cv_seed',
      text: 'React lifecycle hooks.',
      priorityWeight: 0.5,
      coverageWeight: 0.5,
      riskWeight: 0.4,
      proofPointId: 'cov-intent-intent-react',
      testedRoleIntentIds: ['intent-react'],
      recommendedEvidenceIds: ['ev-react-1'],
      evidenceAngle: 'frontend delivery ownership',
      preparationGuidance: {
        proofAngle: 'frontend delivery ownership',
        howToUse: 'Prepare one example that shows frontend delivery ownership.',
      },
      hiringLogicCoverage: {
        businessProblemIds: ['business-problem:frontend-delivery'],
        idealCandidateSignalIds: ['candidate-signal:react-owner'],
        interviewProbeIds: ['probe:react-delivery'],
      },
      evidenceMapStrength: 0.9,
      coveragePriority: 'must_cover',
      modeCompatibility: { technical: true, behavioural: false, combined: true },
    },
    {
      questionId: 'q-react-asked',
      status: 'asked',
      topic: 'react',
      category: 'technical',
      sourceType: 'cv_seed',
      text: 'Asked React lifecycle hooks.',
      priorityWeight: 0.5,
      coverageWeight: 0.5,
      riskWeight: 0.4,
      proofPointId: 'cov-intent-intent-react',
      testedRoleIntentIds: ['intent-react'],
      recommendedEvidenceIds: ['ev-react-1'],
      coveragePriority: 'must_cover',
      modeCompatibility: { technical: true, behavioural: false, combined: true },
    },
    {
      questionId: 'q-node',
      status: 'active',
      topic: 'node',
      category: 'technical',
      sourceType: 'match_gap',
      sourceStage: 'match_gap',
      text: 'Node event loop.',
      priorityWeight: 0.5,
      coverageWeight: 0.5,
      riskWeight: 0.4,
      proofPointId: 'cov-gap-intent-node',
      testedRoleIntentIds: ['intent-node'],
      recommendedEvidenceIds: [],
      coveragePriority: 'should_cover',
      modeCompatibility: { technical: true, behavioural: false, combined: true },
    },
    {
      questionId: 'q-node-asked',
      status: 'asked',
      topic: 'node',
      category: 'technical',
      sourceType: 'match_gap',
      sourceStage: 'match_gap',
      text: 'Asked Node event loop.',
      priorityWeight: 0.5,
      coverageWeight: 0.5,
      riskWeight: 0.4,
      proofPointId: 'cov-gap-intent-node',
      testedRoleIntentIds: ['intent-node'],
      recommendedEvidenceIds: [],
      coveragePriority: 'should_cover',
      modeCompatibility: { technical: true, behavioural: false, combined: true },
    },
  ];

  it('applies roleIntentCoverageBoost to pending/unmet coverage points', () => {
    const proofStrategy = {
      mustCover: [
        { coverageId: 'cov-intent-intent-react', roleIntentId: 'intent-react', status: 'pending' },
        { coverageId: 'cov-gap-intent-node', roleIntentId: 'intent-node', status: 'covered' },
      ],
    };

    const ranked = rankPreparedQuestionPool({
      poolItems,
      session: {
        transcript: [
          { role: 'ai', questionId: 'q-node-asked' }
        ],
        interviewPlan: { roleFit: { proofStrategy } },
      },
      decisionContext: {
        interviewStructure: { focusAreaKey: 'technical' },
      },
    });

    // React is pending -> gets unmet coverage boost (+0.25).
    // Node is covered (because q-node-asked was asked) -> no coverage boost, only gap risk boost (+0.20).
    // Thus React (score ~ 0.82) should rank higher than Node (score ~ 0.77).
    expect(ranked[0].questionId).toBe('q-react');
    expect(ranked[0].reasons).toContain('unmet_must_cover_boost');
    expect(ranked.find(q => q.questionId === 'q-node').reasons).not.toContain('unmet_must_cover_boost');
  });

  it('applies gapRiskBoost to gap validation questions', () => {
    const proofStrategy = {
      mustCover: [
        { coverageId: 'cov-intent-intent-react', roleIntentId: 'intent-react', status: 'covered' },
        { coverageId: 'cov-gap-intent-node', roleIntentId: 'intent-node', status: 'pending' },
      ],
    };

    const ranked = rankPreparedQuestionPool({
      poolItems,
      session: {
        transcript: [
          { role: 'ai', questionId: 'q-react-asked' }
        ],
        interviewPlan: { roleFit: { proofStrategy } },
      },
      decisionContext: {
        interviewStructure: { focusAreaKey: 'technical' },
      },
    });

    // React is covered -> no coverage boost (0).
    // Node is pending -> gets unmet coverage boost (+0.25) AND gap risk boost (+0.20) because it's a gap validation question.
    // Node should be rank 1.
    expect(ranked[0].questionId).toBe('q-node');
    expect(ranked[0].reasons).toContain('unmet_must_cover_boost');
    expect(ranked[0].reasons).toContain('gap_validation_boost');
  });

  it('applies evidenceOverusePenalty when evidence is over-referenced', () => {
    const proofStrategy = {
      mustCover: [
        { coverageId: 'cov-intent-intent-react', roleIntentId: 'intent-react', status: 'pending' },
        { coverageId: 'cov-gap-intent-node', roleIntentId: 'intent-node', status: 'pending' },
      ],
    };

    const ranked = rankPreparedQuestionPool({
      poolItems,
      session: {
        transcript: [
          // Simulate two turns that already used ev-react-1
          { role: 'ai', text: 'First react question.', metadata: { countsAsQuestion: true, rankTrace: { recommendedEvidenceIds: ['ev-react-1'], evidenceAngle: 'technical_ownership' } } },
          { role: 'ai', text: 'Second react question.', metadata: { countsAsQuestion: true, questionDecision: { rankTrace: { recommendedEvidenceIds: ['ev-react-1'], evidenceAngle: 'technical_ownership' } } } },
        ],
        interviewPlan: { roleFit: { proofStrategy } },
      },
      decisionContext: {
        interviewStructure: { focusAreaKey: 'technical' },
      },
    });

    // React uses 'ev-react-1' which has count 2 (>= 2).
    // It gets evidenceOverusePenalty (-0.35).
    // Therefore Node should rank higher than React.
    expect(ranked[0].questionId).toBe('q-node');
    expect(ranked.find(q => q.questionId === 'q-react').penalties).toContain('evidence_overuse_penalty');
  });

  it('separates the legacy base score from traceable Role-Fit adjustments', () => {
    const [ranked] = rankPreparedQuestionPool({
      poolItems: [poolItems[0]],
      session: {
        transcript: [],
        interviewPlan: {
          roleFit: {
            proofStrategy: {
              mustCover: [{ coverageId: 'cov-intent-intent-react', roleIntentId: 'intent-react', status: 'pending' }],
            },
          },
        },
      },
      decisionContext: { interviewStructure: { focusAreaKey: 'technical' } },
    });

    expect(ranked.rankTrace).toEqual(expect.objectContaining({
      baseScore: expect.any(Number),
      roleFitAdjustment: expect.objectContaining({
        roleIntentCoverageBoost: expect.any(Number),
        evidenceMapStrengthBoost: expect.any(Number),
        unmetCoverageBoost: expect.any(Number),
        gapRiskBoost: expect.any(Number),
        proofAngleFitBoost: expect.any(Number),
        hiringLogicLinkBoost: expect.any(Number),
        evidenceOverusePenalty: expect.any(Number),
        total: expect.any(Number),
      }),
      evidenceAngle: 'frontend delivery ownership',
      preparationGuidance: expect.objectContaining({
        proofAngle: 'frontend delivery ownership',
      }),
      hiringLogicCoverage: expect.objectContaining({
        businessProblemIds: ['business-problem:frontend-delivery'],
      }),
    }));
    expect(ranked.reasons).toContain('proof_angle_fit_boost');
    expect(ranked.reasons).toContain('hiring_logic_link_boost');
    expect(ranked.score).toBeCloseTo(ranked.rankTrace.baseScore + ranked.rankTrace.roleFitAdjustment.total, 3);
  });
});
