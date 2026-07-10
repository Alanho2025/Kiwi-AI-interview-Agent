import { describe, expect, it } from 'vitest';
import {
  buildInterviewProofStrategy,
  addRoleFitMetadataToQuestionPool,
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

    // Node (high priority & gap) should be in mustCover
    const nodeCover = strategy.mustCover.find(c => c.roleIntentId === 'intent-node');
    expect(nodeCover).toBeDefined();
    expect(nodeCover.type).toBe('role_intent'); // targetRoleIntentId matched

    // Node is also classified as a gap, so it should have a gap_validation mustCover item
    const gapCover = strategy.mustCover.find(c => c.coverageId === 'cov-gap-intent-node');
    expect(gapCover).toBeDefined();
    expect(gapCover.type).toBe('gap_validation');
    expect(gapCover.evidenceOptions).toEqual([]);
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
});
