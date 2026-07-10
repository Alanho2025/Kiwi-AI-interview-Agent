import { describe, expect, it } from 'vitest';
import {
  buildInterviewProofStrategy,
  addRoleFitMetadataToQuestionPool,
  buildRoleFitQuestionPool,
} from '../../../src/services/questions/roleSpecificPracticePlannerService.js';

describe('roleSpecificPracticePlannerService', () => {
  const roleFitProfile = {
    id: 'profile-1',
    roleIntent: {
      items: [
        { id: 'intent-react', statement: 'React frontend experience', priority: 'high', category: 'technical' },
        { id: 'intent-node', statement: 'Node.js backend experience', priority: 'high', category: 'technical' },
        { id: 'intent-teamwork', statement: 'Team leadership', priority: 'medium', category: 'behavioural' },
      ],
    },
  };

  const roleEvidenceMap = {
    matchAnalysisId: 'analysis-1',
    items: [
      {
        roleIntentId: 'intent-react',
        roleIntent: 'React frontend experience',
        classification: 'direct',
        sourceEvidence: [{ evidenceId: 'ev-react-1' }],
      },
      {
        roleIntentId: 'intent-node',
        roleIntent: 'Node.js backend experience',
        classification: 'gap',
        sourceEvidence: [],
      },
      {
        roleIntentId: 'intent-teamwork',
        roleIntent: 'Team leadership',
        classification: 'adjacent',
        sourceEvidence: [{ evidenceId: 'ev-lead-1' }],
      },
    ],
  };

  it('builds a valid InterviewProofStrategy', () => {
    const strategy = buildInterviewProofStrategy({ roleFitProfile, roleEvidenceMap });

    expect(strategy.schemaVersion).toBe('interview_proof_strategy_v1');
    expect(strategy.roleIntentProfileId).toBe('profile-1');
    expect(strategy.roleEvidenceMapId).toBe('analysis-1');
    expect(strategy.targetRoleIntentIds).toEqual(['intent-react', 'intent-node']);

    // Check mustCover mapping
    // React (high priority) should be role_intent
    const reactCover = strategy.mustCover.find(c => c.roleIntentId === 'intent-react');
    expect(reactCover).toBeDefined();
    expect(reactCover.type).toBe('role_intent');
    expect(reactCover.evidenceOptions).toEqual(['ev-react-1']);

    const nodeCovers = strategy.mustCover.filter(c => c.roleIntentId === 'intent-node');
    expect(nodeCovers).toEqual([
      expect.objectContaining({
        coverageId: 'cov-gap-intent-node',
        type: 'gap_validation',
        evidenceOptions: [],
      }),
    ]);
  });

  it('enriches a question pool with v3 metadata', () => {
    const poolItems = [
      { questionId: 'q-1', topic: 'react', text: 'React hook lifecycle' },
      { questionId: 'q-2', topic: 'node', text: 'Node event loop' },
    ];

    const enriched = addRoleFitMetadataToQuestionPool({
      poolItems,
      roleEvidenceMap,
      roleFitProfile,
    });

    expect(enriched).toHaveLength(2);
    
    const reactQ = enriched.find(q => q.questionId === 'q-1');
    expect(reactQ.proofPointId).toBe('cov-intent-intent-react');
    expect(reactQ.testedRoleIntentIds).toEqual(['intent-react']);
    expect(reactQ.recommendedEvidenceIds).toEqual(['ev-react-1']);
    expect(reactQ.coveragePriority).toBe('must_cover');
    expect(reactQ.roleFitReason).toContain('React frontend experience');

    const nodeQ = enriched.find(q => q.questionId === 'q-2');
    expect(nodeQ.proofPointId).toBe('cov-gap-intent-node');
    expect(nodeQ.testedRoleIntentIds).toEqual(['intent-node']);
    expect(nodeQ.recommendedEvidenceIds).toEqual([]);
    expect(nodeQ.coveragePriority).toBe('must_cover'); // high priority intent gap
  });

  it('does not attach the first role intent to an unrelated question', () => {
    const [opening] = addRoleFitMetadataToQuestionPool({
      poolItems: [{ questionId: 'q-opening', topic: 'self_intro', text: 'Please introduce yourself.' }],
      roleEvidenceMap,
      roleFitProfile,
    });

    expect(opening).toEqual(expect.objectContaining({
      testedRoleIntentIds: [],
      recommendedEvidenceIds: [],
      coverageContractIds: [],
      proofPointId: '',
    }));
  });

  it('represents every must-cover contract with a v3 question or explicit degraded fallback', () => {
    const result = buildRoleFitQuestionPool({
      poolItems: [{
        questionId: 'q-react',
        sessionId: 'session-1',
        schemaVersion: 'v3',
        questionRole: 'root_question',
        status: 'active',
        topic: 'react',
        category: 'technical',
        text: 'Tell me about your React experience.',
        fallbackText: 'Tell me about your React experience.',
      }],
      roleEvidenceMap,
      roleFitProfile,
      context: { userId: 'user-1', sessionId: 'session-1', matchAnalysisId: 'analysis-1' },
    });

    expect(result.readiness).toMatchObject({ status: 'ready', unresolvedCoverageIds: [] });
    expect(result.proofStrategy.mustCover).toHaveLength(2);
    result.proofStrategy.mustCover.forEach((coverage) => {
      expect(result.items.some((item) => item.coverageContractIds.includes(coverage.coverageId))).toBe(true);
    });
    expect(result.items).toContainEqual(expect.objectContaining({
      schemaVersion: 'v3',
      sourceStage: 'role_fit_fallback',
      testedRoleIntentIds: ['intent-node'],
      coverageContractIds: ['cov-gap-intent-node'],
    }));
  });

  it('returns an explicit degraded strategy when role-fit artifacts are unavailable', () => {
    const result = buildRoleFitQuestionPool({
      poolItems: [],
      roleEvidenceMap: {},
      roleFitProfile: {},
      context: { userId: 'user-1', sessionId: 'session-1' },
    });

    expect(result.proofStrategy).toMatchObject({
      artifactStatus: 'degraded',
      degradedReason: 'missing_role_fit_artifacts',
      mustCover: [expect.objectContaining({ status: 'degraded' })],
    });
    expect(result.readiness.status).toBe('degraded');
  });
});
