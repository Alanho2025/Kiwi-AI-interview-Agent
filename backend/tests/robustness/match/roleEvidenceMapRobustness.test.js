import { describe, expect, it } from 'vitest';

import { buildRoleEvidenceMap } from '../../../src/services/match/roleEvidenceMapService.js';
import { buildSemanticEvidenceContext, getSemanticMatchesForLabel } from '../../../src/services/match/semanticEvidenceService.js';
import { compareCvToJobDescription } from '../../../src/services/matchService.js';

const roleFitProfile = {
  roleIntent: {
    rolePurpose: {
      shortStatement: 'Help the employer keep customer data delivery reliable.',
    },
    businessProblemHypotheses: [{
      id: 'business-problem:data-reliability',
      statement: 'Customer data delivery may be fragile when production pipelines fail.',
    }],
    workflowPainPoints: [{
      id: 'workflow-pain:failed-loads',
      statement: 'Failed data loads need clearer recovery and ownership.',
    }],
    idealCandidateSignals: [{
      id: 'candidate-signal:sql-delivery-owner',
      roleIntentId: 'intent:sql',
      signal: 'Own production SQL reliability with measurable recovery outcomes.',
    }],
    interviewProbeMap: [{
      probeId: 'probe:sql-reliability',
      testedIntentIds: ['intent:sql'],
      expectedSignals: ['production ownership', 'measurable reliability outcome'],
      riskReduced: 'Checks whether SQL experience is production delivery rather than tool exposure.',
    }],
    items: [
      { id: 'intent:sql', statement: 'Production SQL experience', priority: 'high', sourceLabel: 'JD must-have requirement' },
      { id: 'intent:stakeholder', statement: 'Stakeholder communication', priority: 'high', sourceLabel: 'JD soft skill' },
      { id: 'intent:dbt', statement: 'dbt experience', priority: 'low', sourceLabel: 'JD nice-to-have requirement' },
    ],
  },
};

const tracedEvidence = {
  id: 'evidence:sql-project',
  text: 'Built production SQL pipelines and reduced failed data loads by 35%.',
  evidenceStrength: 'strong',
  score: 0.91,
  responsibilitySignal: true,
  achievementSignal: true,
  proofAngles: ['production ownership', 'measurable reliability impact'],
  strengthSignals: {
    specificity: 90,
    outcomeEvidence: 92,
    personalOwnership: 88,
    credibility: 95,
  },
  howToSayIt: ['Use this as a STAR example: explain the failed-load problem, your pipeline work, and the 35% recovery impact.'],
  avoidUsingFor: ['Do not use this as proof of stakeholder communication unless you add the stakeholder context.'],
  fitLimits: ['Validate the production scale and your exact ownership scope.'],
  sourceTrace: {
    section: 'experience',
    sourceType: 'experience',
    chunkId: 'cv:sql-project',
  },
};

describe('grounded role evidence map robustness', () => {
  it('classifies direct evidence only when a strong score has an explicit source trace', () => {
    const map = buildRoleEvidenceMap({
      roleFitProfile,
      requirementChecks: [{
        id: 'sql',
        label: 'Production SQL experience',
        status: 'met',
        importance: 'high',
        type: 'hard',
      }],
      semanticEvidenceContext: {
        byLabel: { 'production sql experience': [tracedEvidence] },
      },
    });
    const item = map.items.find((entry) => entry.roleIntentId === 'intent:sql');

    expect(map.schemaVersion).toBe('role_evidence_map_v2');
    expect(map.compatibilityVersion).toBe('role_evidence_map_v1');
    expect(item.classification).toBe('direct');
    expect(item.fitType).toBe('direct');
    expect(item.score).toBeGreaterThanOrEqual(80);
    expect(item.sourceEvidence[0].sourceTrace.section).toBe('experience');
    expect(item.sourceEvidence[0]).toEqual(expect.objectContaining({
      proofAngles: ['production ownership', 'measurable reliability impact'],
      strengthSignals: expect.objectContaining({ credibility: 95 }),
      howToSayIt: tracedEvidence.howToSayIt,
      avoidUsingFor: tracedEvidence.avoidUsingFor,
      fitLimits: tracedEvidence.fitLimits,
    }));
    expect(item.proofAngle).toBe('production ownership');
    expect(item.evidenceGuidance).toEqual(expect.objectContaining({
      howToSayIt: tracedEvidence.howToSayIt,
      avoidUsingFor: tracedEvidence.avoidUsingFor,
      fitLimits: tracedEvidence.fitLimits,
    }));
    expect(item.hiringLogicLinks).toEqual(expect.objectContaining({
      rolePurpose: 'Help the employer keep customer data delivery reliable.',
      businessProblemIds: ['business-problem:data-reliability'],
      workflowPainPointIds: ['workflow-pain:failed-loads'],
      idealCandidateSignalIds: ['candidate-signal:sql-delivery-owner'],
      interviewProbeIds: ['probe:sql-reliability'],
    }));
    expect(item.componentScores).toEqual(expect.objectContaining({
      semanticRelevance: expect.any(Number),
      jdRequirementMatch: 100,
      roleIntentMatch: expect.any(Number),
      specificity: expect.any(Number),
      personalOwnership: 100,
      outcomeEvidence: 100,
    }));
  });

  it('forces an untraceable semantic match to gap even when similarity is high', () => {
    const map = buildRoleEvidenceMap({
      roleFitProfile,
      requirementChecks: [{ label: 'Production SQL experience', status: 'met', importance: 'high', type: 'hard' }],
      semanticEvidenceContext: {
        byLabel: {
          'production sql experience': [{ ...tracedEvidence, id: '', sourceTrace: null, score: 0.99 }],
        },
      },
    });
    const item = map.items.find((entry) => entry.roleIntentId === 'intent:sql');

    expect(item.classification).toBe('gap');
    expect(item.sourceEvidence).toHaveLength(0);
    expect(item.limitation).toMatch(/source trace/i);
  });

  it('summarises high-priority role intent coverage as strong, partial, or missing', () => {
    const map = buildRoleEvidenceMap({
      roleFitProfile,
      requirementChecks: [
        { label: 'Production SQL experience', status: 'met', importance: 'high', type: 'hard' },
        { label: 'Stakeholder communication', status: 'partial', importance: 'high', type: 'soft' },
      ],
      semanticEvidenceContext: {
        byLabel: {
          'production sql experience': [tracedEvidence],
          'stakeholder communication': [{
            ...tracedEvidence,
            id: 'evidence:stakeholder',
            text: 'Presented weekly updates to an internal project team.',
            score: 0.66,
            achievementSignal: false,
            sourceTrace: { section: 'projects', sourceType: 'project_responsibility', chunkId: 'cv:stakeholder' },
          }],
        },
      },
    });

    expect(map.intentCoverage).toMatchObject({
      highPriorityTotal: 2,
      strong: 1,
      partial: 1,
      missing: 0,
    });
    expect(map.items.find((entry) => entry.roleIntentId === 'intent:stakeholder').classification).toBe('adjacent');
    expect(map.items.find((entry) => entry.roleIntentId === 'intent:stakeholder').limitation).toMatch(/direct|outcome|scope/i);
  });

  it('ranks responsibility role intents even when they are not duplicated as requirements', async () => {
    const context = await buildSemanticEvidenceContext({
      rubric: {
        roleFit: {
          roleIntent: {
            items: [{ id: 'intent:delivery', statement: 'Own reliable customer data delivery', priority: 'high' }],
          },
        },
      },
      evidenceProfile: {
        evidenceItems: [{
          ...tracedEvidence,
          text: 'Owned customer analytics data pipelines and improved failed-load recovery.',
        }],
      },
    });

    expect(getSemanticMatchesForLabel(context, 'Own reliable customer data delivery').length).toBeGreaterThan(0);
  });

  it('keeps the grounded role evidence map in the validated match result', async () => {
    const rubricWithRoleFit = {
      schemaVersion: 'v3',
      title: 'Data Engineer',
      jobTitle: 'Data Engineer',
      roleSummary: ['Build production data pipelines.'],
      macroCriteria: [{ label: 'technical expertise', weight: 1 }],
      microCriteria: [{ label: 'SQL', weight: 1 }],
      requirements: [{ id: 'sql', label: 'Production SQL experience', type: 'hard', importance: 'high' }],
      weights: {
        macro: { technical_expertise: 1 },
        micro: { sql: 1 },
        overall: { macro: 0.45, micro: 0.35, requirements: 0.2 },
      },
      technicalSkillRequirements: ['SQL'],
      softSkillRequirements: [],
      mustHaveRequirements: ['Production SQL experience'],
      niceToHaveExperience: [],
      roleFit: roleFitProfile,
    };
    const result = await compareCvToJobDescription(
      'Ari Wong\nExperience\nBuilt production SQL pipelines and reduced failed data loads by 35%.',
      'Data Engineer role',
      rubricWithRoleFit
    );

    expect(result.roleEvidenceMap.schemaVersion).toBe('role_evidence_map_v2');
    expect(result.roleEvidenceMap.compatibilityVersion).toBe('role_evidence_map_v1');
    expect(result.roleEvidenceMap.items).toHaveLength(3);
    expect(result.matchingDetails.roleEvidenceMap).toEqual(result.roleEvidenceMap);
    expect(result.roleFitDiagnostics).toMatchObject({
      schemaVersion: 'role_fit_diagnostics_v1',
      companyContextStatus: 'missing',
      evidenceMapCoverage: expect.any(Number),
      counts: expect.objectContaining({
        roleIntentCount: 3,
        evidenceMapItemCount: 3,
      }),
    });
    expect(result.matchingDetails.roleFitDiagnostics).toEqual(result.roleFitDiagnostics);
    expect(result.roleEvidenceMap.items.find((item) => item.roleIntentId === 'intent:sql').sourceEvidence[0].sourceTrace.section).toBe('experience');
    expect(result.evidenceMap).toEqual([]);
  });
});
