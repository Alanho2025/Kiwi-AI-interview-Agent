import { describe, expect, it, vi } from 'vitest';

import {
  assessQuestionPoolReadiness,
  buildPreparationGoals,
  generateBoundedReserveQuestions,
  prepareInterviewQuestionPool,
} from '../../../src/services/questions/questionPoolPreparationService.js';
import { QUESTION_CATALOG_SEED } from '../../../src/data/questionCatalogSeed2026_1.js';

const root = (id, topic, text = `Tell me about ${topic}?`) => ({
  questionId: id,
  sessionId: 'session-1',
  questionRole: 'root_question',
  status: 'active',
  topic,
  category: 'technical',
  questionFamily: 'role_specific',
  text,
  fallbackText: text,
});

describe('question pool preparation readiness', () => {
  it('degrades a numerically sufficient pool when a must-cover contract has no question', () => {
    const items = ['react', 'database', 'testing', 'automation', 'deployment']
      .map((topic, index) => root(`q${index}`, topic));

    expect(assessQuestionPoolReadiness({
      items,
      settings: { questionLimit: 8, seniorityLevel: 'junior', focusArea: 'combined' },
      proofStrategy: {
        artifactStatus: 'ready',
        mustCover: [{ coverageId: 'cov-missing', minQuestions: 1, status: 'pending' }],
      },
    })).toMatchObject({
      status: 'degraded',
      degradedReason: 'unrepresented_must_cover_contracts',
      unresolvedCoverageIds: ['cov-missing'],
    });
  });

  it('does not generate reserves when the unique prepared pool is sufficient', async () => {
    const items = ['react', 'database', 'testing', 'automation', 'deployment']
      .map((topic, index) => root(`q${index}`, topic));
    const generateReserveQuestions = vi.fn();
    const result = await prepareInterviewQuestionPool({
      settings: { questionLimit: 8, seniorityLevel: 'junior', focusArea: 'combined' },
      composePool: async () => items,
      generateReserveQuestions,
      persistReserveQuestions: vi.fn(),
    });

    expect(result.readiness).toMatchObject({ status: 'ready', requiredUniqueRootCount: 5, uniqueRootCount: 5 });
    expect(generateReserveQuestions).not.toHaveBeenCalled();
  });

  it('generates at most three reserves and rejects duplicates before persistence', async () => {
    const items = [
      root('q1', 'react'),
      root('q2', 'database'),
      root('q3', 'testing'),
    ];
    const duplicate = root('reserve-duplicate', 'react', items[0].text);
    const reserves = [
      duplicate,
      root('reserve-automation', 'automation'),
      root('reserve-deployment', 'deployment'),
    ];
    const generateReserveQuestions = vi.fn().mockResolvedValue(reserves);
    const persistReserveQuestions = vi.fn(async (accepted) => accepted);
    const result = await prepareInterviewQuestionPool({
      settings: { questionLimit: 8, seniorityLevel: 'junior', focusArea: 'combined' },
      composePool: async () => items,
      generateReserveQuestions,
      persistReserveQuestions,
    });

    expect(generateReserveQuestions).toHaveBeenCalledWith(expect.objectContaining({ limit: 2 }));
    expect(persistReserveQuestions).toHaveBeenCalledWith([
      expect.objectContaining({ questionId: 'reserve-automation', sourceStage: 'preparation_reserve' }),
      expect.objectContaining({ questionId: 'reserve-deployment', sourceStage: 'preparation_reserve' }),
    ]);
    expect(result.readiness).toMatchObject({ status: 'ready', uniqueRootCount: 5 });
    expect(result.rejectedReserveQuestions).toEqual([
      expect.objectContaining({ questionId: 'reserve-duplicate', reason: 'duplicate_fingerprint' }),
    ]);
  });

  it('deduplicates reserve questions against earlier accepted reserves in the same batch', async () => {
    const items = [root('q1', 'react'), root('q2', 'database'), root('q3', 'testing')];
    const persistReserveQuestions = vi.fn(async (accepted) => accepted);
    const result = await prepareInterviewQuestionPool({
      settings: { questionLimit: 8, seniorityLevel: 'junior', focusArea: 'combined' },
      composePool: async () => items,
      generateReserveQuestions: async () => [
        root('reserve-automation-1', 'automation', 'Tell me about automation?'),
        root('reserve-automation-2', 'automation', 'Describe your automation experience?'),
        root('reserve-deployment', 'deployment', 'Tell me about deployment?'),
      ],
      persistReserveQuestions,
    });

    expect(persistReserveQuestions).toHaveBeenCalledWith([
      expect.objectContaining({ questionId: 'reserve-automation-1' }),
      expect.objectContaining({ questionId: 'reserve-deployment' }),
    ]);
    expect(result.readiness).toMatchObject({ status: 'ready', uniqueRootCount: 5 });
  });

  it('returns degraded readiness without repeating questions when reserve generation fails', async () => {
    const items = [root('q1', 'react')];
    const result = await prepareInterviewQuestionPool({
      settings: { questionLimit: 8, seniorityLevel: 'junior', focusArea: 'combined' },
      composePool: async () => items,
      generateReserveQuestions: async () => { throw new Error('DeepSeek unavailable'); },
      persistReserveQuestions: vi.fn(),
    });

    expect(result.items).toEqual(items);
    expect(result.readiness).toMatchObject({
      status: 'degraded',
      degradedReason: 'insufficient_unique_prepared_questions',
      uniqueRootCount: 1,
    });
    expect(result.reserveGenerationError).toBe('DeepSeek unavailable');
  });

  it('counts unique assessment keys instead of raw pool rows', () => {
    const readiness = assessQuestionPoolReadiness({
      items: [root('q1', 'ownership'), root('q2', 'accountability')],
      settings: { questionLimit: 8, seniorityLevel: 'junior', focusArea: 'combined' },
    });

    expect(readiness.uniqueRootCount).toBe(1);
    expect(readiness.status).toBe('degraded');
  });

  it('accepts only grounded reserve questions for controller-provided goal IDs and mode', async () => {
    const callModel = vi.fn().mockResolvedValue({
      content: JSON.stringify({
        questions: [
          { goalId: 'unknown', text: 'Tell me about an unrelated topic?', category: 'technical' },
          { goalId: 'goal-react', text: 'How did you validate a React change?', category: 'technical' },
          { goalId: 'goal-teamwork', text: 'Tell me about a team conflict?', category: 'behavioural' },
        ],
      }),
    });

    const generated = await generateBoundedReserveQuestions({
      sessionId: 'session-1',
      userId: 'user-1',
      limit: 3,
      settings: { focusArea: 'technical' },
      unmetGoals: [
        { id: 'goal-react', topic: 'react', category: 'technical', evidence: ['JD requires React'] },
        { id: 'goal-teamwork', topic: 'teamwork', category: 'behavioural', evidence: ['JD requires collaboration'] },
      ],
      callModel,
    });

    expect(generated).toEqual([
      expect.objectContaining({
        topic: 'react',
        text: 'How did you validate a React change?',
        linkedJdRequirement: ['JD requires React'],
      }),
    ]);
  });

  it('offers the reserve model only unmet analysis goals with their correct category', () => {
    const goals = buildPreparationGoals({
      items: [root('existing-react', 'react')],
      analysisResult: {
        matchingDetails: {
          questionPlanHints: {
            mustProbeSkills: ['React', 'testing'],
            mustProbeBehavioural: ['teamwork'],
          },
        },
      },
    });

    expect(goals).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic: 'testing', category: 'technical' }),
      expect.objectContaining({ topic: 'teamwork', category: 'behavioural' }),
    ]));
    expect(goals.some((goal) => goal.topic.toLowerCase() === 'react')).toBe(false);
  });

  it('loads only approved catalog content during preparation and reports an unavailable catalog without blocking the legacy pool', async () => {
    const existingItems = ['react', 'database', 'testing', 'automation', 'deployment']
      .map((topic, index) => root(`q${index}`, topic));
    const catalogItem = {
      ...QUESTION_CATALOG_SEED.find((item) => item.catalogQuestionId === 'ai_assisted_delivery'),
      lifecycle: 'approved',
    };
    const composePool = vi.fn(async () => existingItems);

    const ready = await prepareInterviewQuestionPool({
      userId: 'user-1',
      sessionId: 'session-1',
      deliveryMode: 'voice',
      settings: { questionLimit: 8, seniorityLevel: 'senior', focusArea: 'combined' },
      composePool,
      proofStrategy: {},
      loadCatalogItems: async () => ({ status: 'ready', items: [catalogItem] }),
    });
    const unavailable = await prepareInterviewQuestionPool({
      userId: 'user-1',
      sessionId: 'session-1',
      deliveryMode: 'voice',
      settings: { questionLimit: 8, seniorityLevel: 'senior', focusArea: 'combined' },
      composePool,
      proofStrategy: {},
      loadCatalogItems: async () => ({ status: 'catalog_unavailable', items: [] }),
    });

    expect(composePool).toHaveBeenCalledWith(expect.objectContaining({ catalogItems: [catalogItem] }));
    expect(ready.catalogStatus).toBe('ready');
    expect(unavailable.catalogStatus).toBe('catalog_unavailable');
    expect(unavailable.items).toEqual(existingItems);
  });

  it('returns a reviewable Voice catalog coverage plan without claiming pending coverage was asked', async () => {
    const catalogSnapshot = {
      ...root('catalog-ai-workflow', 'ai assisted delivery'),
      catalogQuestionId: 'ai_assisted_delivery',
      catalogLifecycle: 'approved',
      questionFamily: 'ai_assisted_delivery',
      coverageSlot: 'software_ai_workflow',
      selectionPolicy: { minAsked: 1, maxAsked: 1, reservationPriority: 90 },
    };
    const result = await prepareInterviewQuestionPool({
      userId: 'user-1',
      sessionId: 'session-1',
      deliveryMode: 'voice',
      analysisResult: {
        jobTitle: 'Software Engineer',
        parsedJdProfile: { roleFamily: 'software_development' },
      },
      settings: { questionLimit: 8, seniorityLevel: 'intermediate', focusArea: 'combined' },
      composePool: async () => [
        ...['react', 'database', 'testing', 'automation'].map((topic, index) => root(`q${index}`, topic)),
        catalogSnapshot,
      ],
      proofStrategy: {},
      loadCatalogItems: async () => ({
        status: 'ready',
        items: [{
          ...QUESTION_CATALOG_SEED.find((item) => item.catalogQuestionId === 'ai_assisted_delivery'),
          lifecycle: 'approved',
        }],
      }),
    });

    expect(result.catalogCoverage).toEqual(expect.objectContaining({
      status: 'pending',
      reservations: [
        expect.objectContaining({
          coverageSlot: 'software_ai_workflow',
          status: 'pending',
          askedCount: 0,
        }),
      ],
    }));
  });

  it('does not load or compose catalog content for text sessions', async () => {
    const existingItems = ['react', 'database', 'testing', 'automation', 'deployment']
      .map((topic, index) => root(`q${index}`, topic));
    const loadCatalogItems = vi.fn(async () => ({ status: 'ready', items: [QUESTION_CATALOG_SEED[0]] }));
    const composePool = vi.fn(async () => existingItems);

    const result = await prepareInterviewQuestionPool({
      userId: 'user-1',
      sessionId: 'session-1',
      deliveryMode: 'text',
      settings: { questionLimit: 8, seniorityLevel: 'senior', focusArea: 'combined' },
      composePool,
      proofStrategy: {},
      loadCatalogItems,
    });

    expect(loadCatalogItems).not.toHaveBeenCalled();
    expect(composePool).toHaveBeenCalledWith(expect.objectContaining({ catalogItems: [] }));
    expect(result.catalogStatus).toBe('not_applicable');
    expect(result.catalogCoverage).toEqual({ status: 'not_applicable', reservations: [] });
    expect(result.items).toEqual(existingItems);
  });

  it('does not pass a request-supplied catalog version into the Voice catalog loader', async () => {
    const loadCatalogItems = vi.fn(async () => ({ status: 'inactive', items: [] }));
    await prepareInterviewQuestionPool({
      deliveryMode: 'voice',
      settings: { questionCatalogVersion: '2026.1' },
      loadCatalogItems,
      composePool: async () => [],
    });

    expect(loadCatalogItems).toHaveBeenCalledTimes(1);
    expect(loadCatalogItems.mock.calls[0][0]).not.toHaveProperty('catalogVersion');
    expect(loadCatalogItems.mock.calls[0][0]).not.toHaveProperty('settings');
  });
});
