import { describe, expect, it, vi } from 'vitest';
import {
  buildQuestionPoolReconciliationPlan,
  buildInterviewQuestionPoolItems,
  buildPreparedRootQuestionPoolQuery,
  composeInterviewQuestionPool,
  restorePreparedQuestionPoolFromQuestionSet,
} from '../../../src/services/questions/questionPoolComposerService.js';
import * as questionPoolComposerService from '../../../src/services/questions/questionPoolComposerService.js';
import { validatePreparedQuestionPool } from '../../../src/services/schemaValidationService.js';
import { QUESTION_CATALOG_SEED } from '../../../src/data/questionCatalogSeed2026_1.js';

const baseArgs = {
  userId: 'user-1',
  sessionId: 'session-1',
  cvFileId: 'cv-1',
  matchAnalysisId: 'match-1',
  jdFingerprint: 'jd-1',
  settings: { focusArea: 'Combined', seniorityLevel: 'Junior/Grad' },
};

describe('questionPoolComposerService', () => {
  it.each(['text', 'voice'])('reuses the same persisted question set for %s preparation retries', async (deliveryMode) => {
    const canonicalItems = [{ questionId: 'canonical-question', text: 'Tell me about API design.' }];
    const loadQuestionSet = vi.fn(async () => ({ definition: { items: canonicalItems } }));
    const restoreQuestionPool = vi.fn(async ({ items }) => items);
    const persistQuestionSet = vi.fn();

    const result = await composeInterviewQuestionPool({
      userId: 'user-1',
      sessionId: 'session-1',
      deliveryMode,
      loadQuestionSet,
      restoreQuestionPool,
      persistQuestionSet,
    });

    expect(result).toEqual(canonicalItems);
    expect(loadQuestionSet).toHaveBeenCalledWith({ sessionId: 'session-1', userId: 'user-1' });
    expect(restoreQuestionPool).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: 'session-1',
      userId: 'user-1',
      items: canonicalItems,
    }));
    expect(persistQuestionSet).not.toHaveBeenCalled();
  });

  it('fills a partial persisted pool while preserving existing asked state', async () => {
    const existingItems = [{ questionId: 'canonical-question', userId: 'user-1', status: 'asked', askedTurnIndex: 2 }];
    const questionPoolModel = {
      find: vi.fn(() => ({
        sort: vi.fn(() => ({ lean: vi.fn(async () => existingItems) })),
      })),
      insertMany: vi.fn(async (items) => existingItems.push(...items)),
    };

    const result = await restorePreparedQuestionPoolFromQuestionSet({
      sessionId: 'session-1',
      userId: 'user-1',
      items: [
        { questionId: 'canonical-question', userId: 'user-1', status: 'active' },
        { questionId: 'missing-question', userId: 'user-1', status: 'active' },
      ],
      questionPoolModel,
    });

    expect(result).toEqual(existingItems);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'canonical-question', status: 'asked', askedTurnIndex: 2 }),
      expect.objectContaining({ questionId: 'missing-question', status: 'active' }),
    ]));
    expect(questionPoolModel.find).toHaveBeenCalledWith({ sessionId: 'session-1', userId: 'user-1' });
    expect(questionPoolModel.insertMany).toHaveBeenCalledWith([
      expect.objectContaining({ questionId: 'missing-question' }),
    ], { ordered: false });
  });

  it('does not restore another user pool and verifies a duplicate-write race contains every canonical item', async () => {
    const storedItems = [{ questionId: 'victim-question', userId: 'victim', status: 'asked' }];
    const questionPoolModel = {
      find: vi.fn((query) => ({
        sort: vi.fn(() => ({ lean: vi.fn(async () => storedItems.filter((item) => (
          item.userId === query.userId && query.sessionId === 'shared-session'
        ))) })),
      })),
      insertMany: vi.fn(async (items) => {
        storedItems.push(...items);
        const error = new Error('duplicate race');
        error.code = 11000;
        throw error;
      }),
    };

    const attackerResult = await restorePreparedQuestionPoolFromQuestionSet({
      sessionId: 'shared-session',
      userId: 'attacker',
      items: [],
      questionPoolModel,
    });
    const ownerResult = await restorePreparedQuestionPoolFromQuestionSet({
      sessionId: 'shared-session',
      userId: 'owner',
      items: [{ questionId: 'owner-question', userId: 'owner', status: 'active' }],
      questionPoolModel,
    });

    expect(attackerResult).toEqual([]);
    expect(ownerResult).toEqual([expect.objectContaining({ questionId: 'owner-question', userId: 'owner' })]);
    expect(questionPoolModel.find).toHaveBeenCalledWith({ sessionId: 'shared-session', userId: 'attacker' });
    expect(questionPoolModel.find).toHaveBeenCalledWith({ sessionId: 'shared-session', userId: 'owner' });
  });

  it('uses a cross-role fallback while keeping the internal technical category', () => {
    const pool = questionPoolComposerService.ensureMinimumFallbacks?.([], {
      userId: 'user-cross-role',
      sessionId: 'session-cross-role',
      roleDomain: 'healthcare',
    }) || [];
    const fallback = pool.find((item) => item.sourceType === 'fallback' && item.category === 'technical');

    expect(fallback?.text || '').toContain('role-specific task');
    expect(fallback?.text || '').not.toMatch(/what did you build|technical task/i);
    expect(fallback).toMatchObject({
      questionFamily: 'role_specific',
      roleDomain: 'healthcare',
    });
  });

  it('creates opening, motivation, role requirement, gap, behavioural, and wrap-up questions', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        jobTitle: 'Frontend Developer',
        gaps: ['testing evidence'],
        requirementChecks: [{ requirement: 'React', met: false, category: 'technical' }],
        matchingDetails: {
          questionPlanHints: {
            mustProbeSkills: ['React'],
            mustProbeBehavioural: ['teamwork'],
            priorityTopics: ['React'],
          },
        },
      },
      cvSeeds: [{
        seedId: 'seed-1',
        sourceType: 'cv_project',
        topic: 'React',
        category: 'technical',
        questionIntent: 'validate_ownership',
        draftQuestion: 'Tell me about one React project.',
        skillTags: ['React'],
        confidence: 0.8,
        priorityWeight: 0.7,
      }],
      jdFilter: { filterDecisions: [{ seedId: 'seed-1', decision: 'boost', scoreDelta: 0.2 }] },
    });

    expect(pool.some((item) => item.category === 'opening')).toBe(true);
    expect(pool.some((item) => item.category === 'motivation')).toBe(true);
    expect(pool.some((item) => item.sourceType === 'jd_requirement')).toBe(true);
    expect(pool.some((item) => item.sourceStage === 'match_gap')).toBe(true);
    expect(pool.some((item) => item.category === 'behavioural')).toBe(true);
    expect(pool.some((item) => item.category === 'closing')).toBe(true);
    expect(pool.every((item) => ['root_question', 'fallback_root', 'wrap_up'].includes(item.questionRole))).toBe(true);
    expect(pool.every((item) => Number.isFinite(item.maxFollowUps))).toBe(true);
    expect(pool.every((item) => Array.isArray(item.followUpStrategies))).toBe(true);
    expect(pool.find((item) => item.category === 'closing').questionRole).toBe('wrap_up');
    expect(pool.find((item) => item.sourceStage === 'match_gap').questionRole).toBe('root_question');
  });

  it('keeps internal match-gap analysis out of the candidate-facing spoken question', () => {
    const internalGapSummary = 'Limited direct evidence for strong communication skills across commercial, marketing, design, manufacturing, and finance stakeholders';
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      deliveryMode: 'voice',
      analysisResult: {
        jobTitle: 'Product Manager',
        gaps: [{
          id: 'gap-stakeholder-communication',
          topic: 'cross-functional stakeholder communication',
          summary: internalGapSummary,
        }],
        matchingDetails: {
          questionPlanHints: {
            mustProbeSkills: [],
            mustProbeBehavioural: [],
          },
        },
      },
    });

    const gapQuestion = pool.find((item) => item.sourceStage === 'match_gap');

    expect(gapQuestion?.text).toBe(
      'Can you describe a relevant example involving cross-functional stakeholder communication, including what you personally owned?',
    );
    expect(gapQuestion?.text).not.toMatch(/i want to validate|possible gap|limited direct evidence/i);
    expect(gapQuestion?.text).not.toContain(internalGapSummary);
    expect(gapQuestion?.metadata?.gap?.summary).toBe(internalGapSummary);
  });

  it('uses a bounded generic voice topic when the only gap label is a long internal summary', () => {
    const internalGapSummary = 'Limited direct evidence for strong communication skills across commercial, marketing, design, manufacturing, and finance stakeholders, with a need to translate technical concepts for senior leaders';
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      deliveryMode: 'voice',
      analysisResult: {
        gaps: [{ id: 'gap-long-summary', summary: internalGapSummary }],
        matchingDetails: { questionPlanHints: { mustProbeSkills: [], mustProbeBehavioural: [] } },
      },
    });

    const gapQuestion = pool.find((item) => item.sourceStage === 'match_gap');
    expect(gapQuestion?.text).toBe(
      'Can you describe a relevant example involving this role, including what you personally owned?',
    );
    expect(gapQuestion?.text).not.toContain(internalGapSummary);
    expect(gapQuestion?.metadata?.gap?.summary).toBe(internalGapSummary);
  });

  it('preserves the existing text-session gap wording', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      deliveryMode: 'text',
      analysisResult: {
        gaps: [{ id: 'gap-text', topic: 'stakeholder communication' }],
        matchingDetails: { questionPlanHints: { mustProbeSkills: [], mustProbeBehavioural: [] } },
      },
    });

    expect(pool.find((item) => item.sourceStage === 'match_gap')?.text).toBe(
      'I want to validate one possible gap around stakeholder communication. What related experience do you have, and what did you personally own?',
    );
  });

  it('deduplicates similar questions and keeps fallback technical and behavioural coverage', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        matchingDetails: { questionPlanHints: { mustProbeSkills: [], mustProbeBehavioural: [] } },
      },
      cvSeeds: [
        {
          seedId: 'seed-1',
          sourceType: 'cv_skill',
          topic: 'React',
          category: 'technical',
          questionIntent: 'validate_depth',
          draftQuestion: 'Tell me about React.',
          confidence: 0.8,
        },
        {
          seedId: 'seed-2',
          sourceType: 'cv_skill',
          topic: 'React',
          category: 'technical',
          questionIntent: 'validate_depth',
          draftQuestion: 'Tell me about another React example.',
          confidence: 0.8,
        },
      ],
    });

    const reactDepthItems = pool.filter((item) => item.topic === 'React' && item.questionIntent === 'validate_depth');
    expect(reactDepthItems).toHaveLength(1);
    expect(pool.some((item) => ['technical', 'role_competency'].includes(item.category))).toBe(true);
    expect(pool.some((item) => item.category === 'behavioural')).toBe(true);
  });

  it('deduplicates identical wording across different topics and merges evidence', () => {
    const repeatedText = 'Tell me about a time you showed ownership. What was the situation, what did you do, and what changed afterwards?';
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        matchingDetails: { questionPlanHints: { mustProbeSkills: [], mustProbeBehavioural: [] } },
      },
      cvSeeds: [
        {
          seedId: 'ownership-seed',
          sourceType: 'cv_behavioural',
          topic: 'ownership',
          category: 'behavioural',
          questionIntent: 'behavioural_star',
          draftQuestion: repeatedText,
          evidenceRefs: [{ text: 'Owned the delivery plan.' }],
        },
        {
          seedId: 'accountability-seed',
          sourceType: 'cv_behavioural',
          topic: 'accountability',
          category: 'behavioural',
          questionIntent: 'behavioural_star',
          draftQuestion: repeatedText,
          evidenceRefs: [{ text: 'Took accountability for the outcome.' }],
        },
      ],
    });

    const repeatedItems = pool.filter((item) => item.text === repeatedText);
    expect(repeatedItems).toHaveLength(1);
    expect(repeatedItems[0].linkedCvEvidence).toEqual(expect.arrayContaining([
      expect.objectContaining({ text: 'Owned the delivery plan.' }),
      expect.objectContaining({ text: 'Took accountability for the outcome.' }),
    ]));
    expect(repeatedItems[0]).toEqual(expect.objectContaining({
      assessmentKey: 'root:ownership:behavioural',
      questionFingerprint: expect.any(String),
    }));
  });

  it('deduplicates reworded behavioural roots that share a canonical assessment key', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        matchingDetails: { questionPlanHints: { mustProbeSkills: [], mustProbeBehavioural: [] } },
      },
      cvSeeds: [
        {
          seedId: 'teamwork-seed',
          sourceType: 'cv_behavioural',
          topic: 'teamwork',
          category: 'behavioural',
          questionIntent: 'behavioural_star',
          draftQuestion: 'Tell me about a teamwork challenge.',
        },
        {
          seedId: 'collaboration-seed',
          sourceType: 'cv_behavioural',
          topic: 'collaboration',
          category: 'behavioural',
          questionIntent: 'behavioural_star',
          draftQuestion: 'Describe a time when collaboration mattered.',
        },
      ],
    });

    expect(pool.filter((item) => item.assessmentKey === 'root:teamwork:behavioural')).toHaveLength(1);
  });

  it('carries cross-role assessment metadata into JD requirement questions', () => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      analysisResult: {
        parsedJdProfile: {
          universalRoleProfile: { roleDomain: 'healthcare' },
        },
        requirementChecks: [{
          label: 'Maintain clinical safety and professional standards',
          status: 'partial',
          category: 'compliance_or_safety',
          capabilityGroup: 'compliance_ethics_safety',
        }],
        matchingDetails: {
          questionPlanHints: {
            mustProbeSkills: [],
            mustProbeBehavioural: [],
          },
        },
      },
    });

    const requirementQuestion = pool.find((item) => item.sourceType === 'jd_requirement');
    expect(requirementQuestion).toMatchObject({
      schemaVersion: 'v3',
      questionFamily: 'role_specific',
      evidenceMode: 'past_example',
      roleDomain: 'healthcare',
      requirementCategory: 'compliance_or_safety',
      capabilityGroup: 'compliance_ethics_safety',
    });
  });

  it('keeps legacy v2 items readable while new prepared items use v3', () => {
    const [legacyItem, currentItem] = validatePreparedQuestionPool([
      {
        questionId: 'legacy-v2',
        sessionId: 'legacy-session',
        schemaVersion: 'v2',
        text: 'Tell me about a project.',
        category: 'technical',
        topic: 'project',
        sourceType: 'legacy_plan',
      },
      {
        questionId: 'current-v3',
        sessionId: 'current-session',
        schemaVersion: 'v3',
        text: 'Tell me about a role-specific project.',
        category: 'technical',
        topic: 'role fit',
        sourceType: 'role_fit',
        coverageContractIds: ['cov-1'],
      },
    ]);

    expect(legacyItem).toMatchObject({ schemaVersion: 'v2' });
    expect(legacyItem).not.toHaveProperty('coverageContractIds');
    expect(currentItem).toMatchObject({ schemaVersion: 'v3', coverageContractIds: ['cov-1'] });
  });

  it('queries prepared root questions with backward compatibility for legacy records', () => {
    const query = buildPreparedRootQuestionPoolQuery({
      sessionId: 'session-1',
      category: 'Technical',
      status: 'active',
    });

    expect(query).toEqual({
      sessionId: 'session-1',
      status: 'active',
      category: 'technical',
      $or: [
        { questionRole: 'root_question' },
        { questionRole: { $exists: false } },
        { questionRole: null },
        { questionRole: '' },
      ],
    });
  });

  it('reconciles legacy transcripts by prepared ID or exact fingerprint only', () => {
    const plan = buildQuestionPoolReconciliationPlan({
      transcript: [
        { role: 'ai', text: 'Tell me about ownership?', metadata: { turnKind: 'root_question' } },
        { role: 'ai', text: 'A different stored wording?', metadata: { preparedQuestionId: 'pool-2' } },
        { role: 'ai', text: 'Tell me about a teamwork challenge in detail?', metadata: { turnKind: 'root_question' } },
      ],
      poolItems: [
        { questionId: 'pool-1', status: 'active', text: 'Tell me about ownership?' },
        { questionId: 'pool-2', status: 'active', text: 'Tell me about database validation?' },
        { questionId: 'pool-3', status: 'active', text: 'Tell me about a teamwork challenge?' },
      ],
    });

    expect(plan.questionIdsToMarkAsked).toEqual(['pool-1', 'pool-2']);
    expect(plan.exactFingerprintMatches).toBe(1);
    expect(plan.preparedIdMatches).toBe(1);
    expect(plan.questionIdsToMarkAsked).not.toContain('pool-3');
  });

  it.each(['text', 'voice'])('snapshots an approved catalog question into the private prepared %s pool without replacing existing sources', (deliveryMode) => {
    const catalogItem = {
      ...QUESTION_CATALOG_SEED.find((item) => item.catalogQuestionId === 'ai_assisted_delivery'),
      lifecycle: 'approved',
    };
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      deliveryMode,
      settings: { focusArea: 'Technical', seniorityLevel: 'Senior', questionLimit: 8 },
      analysisResult: {
        jobTitle: 'Software Engineer',
        parsedJdProfile: { roleFamily: 'software_development' },
        requirementChecks: [{ requirement: 'React', met: false, category: 'technical' }],
        matchingDetails: { questionPlanHints: { mustProbeSkills: ['React'], mustProbeBehavioural: ['teamwork'] } },
      },
      catalogItems: [catalogItem],
    });

    const catalogSnapshot = pool.find((item) => item.catalogQuestionId === 'ai_assisted_delivery');
    expect(catalogSnapshot).toEqual(expect.objectContaining({
      sessionId: 'session-1',
      userId: 'user-1',
      catalogVersion: '2026.1',
      catalogLifecycle: 'approved',
      coverageSlot: 'software_ai_workflow',
    }));
    expect(pool.some((item) => item.sourceType === 'jd_requirement')).toBe(true);
    expect(pool.length).toBeGreaterThan(1);
  });

  it.each([
    ['technical, 8 questions, 15 minutes', { focusArea: 'Technical', questionLimit: 8, timeLimitMinutes: 15 }, false],
    ['technical, 12 questions, 15 minutes', { focusArea: 'Technical', questionLimit: 12, timeLimitMinutes: 15 }, true],
    ['technical, 8 questions, 30 minutes', { focusArea: 'Technical', questionLimit: 8, timeLimitMinutes: 30 }, true],
    ['combined, 12 questions, 15 minutes', { focusArea: 'Combined', questionLimit: 12, timeLimitMinutes: 15 }, false],
    ['combined, 15 questions, 15 minutes', { focusArea: 'Combined', questionLimit: 15, timeLimitMinutes: 15 }, true],
    ['combined, 8 questions, 30 minutes', { focusArea: 'Combined', questionLimit: 8, timeLimitMinutes: 30 }, true],
  ])('adds one deterministic new-project scenario candidate for %s only when eligible', (_label, scenarioSettings, expectedScenario) => {
    const pool = buildInterviewQuestionPoolItems({
      ...baseArgs,
      settings: { seniorityLevel: 'Senior', ...scenarioSettings },
      analysisResult: {
        jobTitle: 'Software Engineer',
        parsedJdProfile: { roleFamily: 'software_development' },
      },
    });
    const scenarioItems = pool.filter((item) => item.sourceType === 'scenario_policy');

    expect(scenarioItems).toHaveLength(expectedScenario ? 1 : 0);
    if (expectedScenario) {
      expect(scenarioItems[0]).toEqual(expect.objectContaining({
        category: 'technical',
        stage: 'scenario',
        topic: 'new_project_delivery',
        questionIntent: 'scenario_problem_solving',
        coverageSlot: 'scenario_problem_solving',
        selectionPolicy: expect.objectContaining({ minAsked: 1, maxAsked: 1, reservationPriority: 75 }),
      }));
    }
  });
  it('excludes qualification requirements from the interview question pool', () => {
    const items = buildInterviewQuestionPoolItems({
      userId: 'user-1',
      sessionId: 'session-1',
      analysisResult: {
        requirementChecks: [
          {
            requirement: 'A tertiary qualification in Computer Science, Data Engineering, Information Systems, or a related field',
            category: 'qualification',
            capabilityGroup: 'professional_credential',
            met: true,
          },
          {
            requirement: 'Strong problem-solving skills and attention to detail',
            category: 'behavioural',
            capabilityGroup: 'behavioural_competency',
            met: false,
          },
        ],
      },
      settings: {},
    });

    const qualificationQuestion = items.find((item) =>
      String(item.topic).toLowerCase().includes('tertiary qualification')
    );

    const problemSolvingQuestion = items.find((item) =>
      String(item.topic).toLowerCase().includes('problem-solving')
    );

    expect(qualificationQuestion).toBeUndefined();
    expect(problemSolvingQuestion).toBeDefined();

    expect(
      items.some((item) =>
        String(item.text).includes(
          'Tell me about one example that shows your evidence for'
        )
      )
    ).toBe(false);
  });
  it('sorts every interviewable requirement by canonical status before session-level capacity selection', () => {
    const requirementChecks = [
      {
        requirement: 'Bachelor degree in Computer Science',
        category: 'qualification',
        capabilityGroup: 'professional_credential',
      },
      {
        requirement: 'Relevant tertiary qualification',
        category: 'credential',
        capabilityGroup: 'professional_credential',
      },
      {
        requirement: 'AWS certification',
        category: 'qualification',
        capabilityGroup: 'professional_credential',
      },
      ...Array.from({ length: 6 }, (_, index) => ({
        requirement: `Already met capability ${index + 1}`,
        category: 'technical',
        capabilityGroup: 'technical_skill',
        status: 'met',
        met: false,
      })),
      {
        requirement: 'Seventh input must-have gap',
        category: 'technical',
        capabilityGroup: 'technical_skill',
        status: 'not_met',
        mustHave: true,
      },
      {
        requirement: 'Unproven hard requirement',
        category: 'technical',
        capabilityGroup: 'technical_skill',
        status: 'inferred',
        type: 'hard',
      },
      {
        requirement: 'Partly evidenced requirement',
        category: 'technical',
        capabilityGroup: 'technical_skill',
        status: 'partial',
      },
    ];

    const items = buildInterviewQuestionPoolItems({
      userId: 'user-1',
      sessionId: 'session-1',
      analysisResult: {
        requirementChecks,
      },
      settings: {},
    });

    const requirementItems = items.filter(
      (item) => item.sourceType === 'jd_requirement'
    );

    expect(requirementItems).toHaveLength(9);

    expect(
      requirementItems.some((item) =>
        /degree|qualification|certification/i.test(item.topic)
      )
    ).toBe(false);

    expect(
      requirementItems.map((item) => item.topic)
    ).toEqual([
      'Seventh input must-have gap',
      'Unproven hard requirement',
      'Partly evidenced requirement',
      'Already met capability 1',
      'Already met capability 2',
      'Already met capability 3',
      'Already met capability 4',
      'Already met capability 5',
      'Already met capability 6',
    ]);
    expect(requirementItems[0]).toMatchObject({
      metadata: {
        requirementSelection: {
          canonicalStatus: 'not_met',
          isMustHave: true,
        },
      },
    });
    expect(requirementItems[0].priorityWeight).toBeCloseTo(0.93);
    expect(requirementItems[0].riskWeight).toBeCloseTo(0.97);
    expect(requirementItems.at(-1)).toMatchObject({
      priorityWeight: 0.44,
      riskWeight: 0.4,
      metadata: {
        requirementSelection: {
          canonicalStatus: 'met',
          isMustHave: false,
        },
      },
    });
  });
  it('classifies soft-skill requirements as behavioural questions', () => {
    const items = buildInterviewQuestionPoolItems({
      userId: 'user-1',
      sessionId: 'session-1',
      analysisResult: {
        requirementChecks: [
          {
            requirement: 'Strong communication and stakeholder management skills',
            category: 'must_have',
            capabilityGroup: '',
            met: false,
          },
        ],
      },
    });

    const question = items.find((item) =>
      item.topic.includes('stakeholder management')
    );

    expect(question).toBeDefined();
    expect(question.category).toBe('behavioural');
    expect(question.questionIntent).toBe('behavioural_star');
  });
  it('classifies technical requirements as technical questions', () => {
    const items = buildInterviewQuestionPoolItems({
      userId: 'user-1',
      sessionId: 'session-1',
      analysisResult: {
        requirementChecks: [
          {
            requirement: 'Experience building REST APIs with Node.js',
            category: 'must_have',
            capabilityGroup: 'technical_skill',
            met: false,
          },
        ],
      },
    });

    const question = items.find((item) =>
      item.topic.includes('REST APIs')
    );

    expect(question).toBeDefined();
    expect(question.category).toBe('technical');
    expect(question.questionIntent).toBe('technical_evidence');
    expect(question.text).toMatch(
      /\b(implement|build|built|change|approach|technical decisions)\b/i
    );

    expect(question.text).toMatch(
      /\b(validate|test|evaluate|worked)\b/i
    );
  });
  it('treats problem-solving as behavioural even when upstream category is generic', () => {
    const items = buildInterviewQuestionPoolItems({
      userId: 'user-1',
      sessionId: 'session-1',
      analysisResult: {
        requirementChecks: [
          {
            requirement: 'Strong problem-solving skills and attention to detail',
            category: 'must_have',
            capabilityGroup: '',
            met: false,
          },
        ],
      },
    });

    const question = items.find((item) =>
      item.topic.includes('problem-solving')
    );

    expect(question).toBeDefined();
    expect(question.category).toBe('behavioural');
  });
  it('converts raw JD requirement wording into a natural spoken topic', () => {
    const items = buildInterviewQuestionPoolItems({
      userId: 'user-1',
      sessionId: 'session-1',
      analysisResult: {
        requirementChecks: [
          {
            requirement: 'Experience building REST APIs with Node.js',
            category: 'technical',
            capabilityGroup: 'technical_skill',
            met: false,
          },
        ],
      },
    });

    const question = items.find((item) =>
      item.sourceType === 'jd_requirement'
    );

    expect(question).toBeDefined();
    expect(question.text).toContain('building REST APIs with Node.js');
    expect(question.text).not.toContain(
      'involving Experience building REST APIs with Node.js'
    );
  });
  it('removes JD-style prefixes and suffixes from behavioural topics', () => {
    const items = buildInterviewQuestionPoolItems({
      userId: 'user-1',
      sessionId: 'session-1',
      analysisResult: {
        requirementChecks: [
          {
            requirement: 'Strong communication and stakeholder management skills',
            category: 'must_have',
            capabilityGroup: '',
            met: false,
          },
        ],
      },
    });

    const question = items.find((item) =>
      item.sourceType === 'jd_requirement'
    );

    expect(question).toBeDefined();
    expect(question.category).toBe('behavioural');
    expect(question.text).toContain(
      'communication and stakeholder management'
    );
    expect(question.text).not.toContain('Strong communication');
    expect(question.text).not.toContain('management skills');
  });
});
