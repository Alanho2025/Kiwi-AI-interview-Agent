import { describe, expect, it } from 'vitest';
import { performance } from 'node:perf_hooks';

import { rankPreparedQuestionPool, selectBestPreparedQuestion } from '../../../src/services/questions/questionPoolRankerService.js';

const genericHighScore = {
  questionId: 'generic-high-score',
  status: 'active',
  topic: 'project delivery',
  category: 'technical',
  sourceType: 'cv_project',
  sourceStage: 'cv_seed',
  text: 'Tell me about the project delivery you are most proud of.',
  priorityWeight: 1,
  coverageWeight: 1,
  riskWeight: 1,
  modeCompatibility: { technical: true, combined: true },
};

const reservedAiWorkflow = {
  questionId: 'catalog-ai-workflow',
  status: 'active',
  topic: 'ai assisted delivery',
  category: 'technical',
  sourceType: 'question_catalog',
  sourceStage: 'catalog',
  text: 'How do you use AI while keeping ownership of planning, verification and the final result?',
  priorityWeight: 0.2,
  coverageWeight: 0.2,
  riskWeight: 0.2,
  modeCompatibility: { technical: true, combined: true },
  catalogQuestionId: 'ai_assisted_delivery',
  catalogVersion: '2026.1',
  catalogLifecycle: 'approved',
  questionFamily: 'ai_assisted_delivery',
  coverageSlot: 'software_ai_workflow',
  selectionPolicy: { minAsked: 1, maxAsked: 1, reservationPriority: 90 },
};

describe('question pool ranker catalog policy', () => {
  it('hard-rejects a non-approved catalog snapshot before numeric scoring', () => {
    const ranked = rankPreparedQuestionPool({
      poolItems: [{ ...reservedAiWorkflow, catalogLifecycle: 'draft' }, genericHighScore],
      session: { transcript: [], currentQuestionIndex: 3, questionLimit: 8 },
      decisionContext: { interviewStructure: { focusAreaKey: 'technical' } },
    });

    expect(ranked.map((item) => item.questionId)).toEqual(['generic-high-score']);
    expect(ranked.rejectedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'catalog-ai-workflow', reason: 'catalog_lifecycle_not_approved' }),
    ]));
  });

  it('protects an urgent AI workflow reservation from a higher unconstrained score and records the policy trace', () => {
    const ranked = rankPreparedQuestionPool({
      poolItems: [genericHighScore, reservedAiWorkflow],
      session: { transcript: [], currentQuestionIndex: 6, questionLimit: 8 },
      decisionContext: { interviewStructure: { focusAreaKey: 'technical' } },
    });

    expect(selectBestPreparedQuestion(ranked)).toEqual(expect.objectContaining({ questionId: 'catalog-ai-workflow' }));
    expect(ranked.coverageReservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ coverageSlot: 'software_ai_workflow', status: 'pending', isUrgent: true }),
    ]));
    expect(ranked[0].rankTrace).toEqual(expect.objectContaining({
      catalogQuestionId: 'ai_assisted_delivery',
      catalogVersion: '2026.1',
      coverageSlot: 'software_ai_workflow',
      selectionReason: 'unmet_coverage_reservation',
    }));
  });

  it('hard-rejects a catalog candidate after its coverage slot reaches maxAsked', () => {
    const ranked = rankPreparedQuestionPool({
      poolItems: [reservedAiWorkflow],
      session: {
        transcript: [{
          role: 'ai',
          metadata: { countsAsQuestion: true, coverageSlot: 'software_ai_workflow' },
        }],
        currentQuestionIndex: 3,
        questionLimit: 8,
        settings: { seniorityLevel: 'Senior', focusArea: 'Technical' },
        analysisResult: { parsedJdProfile: { roleFamily: 'software' } },
      },
      decisionContext: { interviewStructure: { focusAreaKey: 'technical' } },
    });

    expect(ranked).toHaveLength(0);
    expect(ranked.coverageReservations).toEqual(expect.arrayContaining([
      expect.objectContaining({ coverageSlot: 'software_ai_workflow', askedCount: 1, maxAsked: 1, status: 'covered' }),
    ]));
    expect(ranked.rejectedCandidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ questionId: 'catalog-ai-workflow', reason: 'catalog_coverage_max_asked_reached' }),
    ]));
  });

  it('keeps deterministic catalog ranking bounded for a large prepared pool', () => {
    const poolItems = Array.from({ length: 500 }, (_, index) => ({
      ...genericHighScore,
      questionId: `generic-${index}`,
      topic: `topic-${index}`,
      text: `Tell me about topic ${index}.`,
    }));
    poolItems.push(reservedAiWorkflow);

    const startedAt = performance.now();
    const ranked = rankPreparedQuestionPool({
      poolItems,
      session: { transcript: [], currentQuestionIndex: 6, questionLimit: 8 },
      decisionContext: { interviewStructure: { focusAreaKey: 'technical' } },
    });
    const durationMs = performance.now() - startedAt;

    expect(ranked[0]).toEqual(expect.objectContaining({ questionId: 'catalog-ai-workflow' }));
    expect(durationMs).toBeLessThan(1000);
  });
});
