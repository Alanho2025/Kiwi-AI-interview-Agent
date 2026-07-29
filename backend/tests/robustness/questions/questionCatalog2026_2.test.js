import { describe, expect, it, vi } from 'vitest';

import {
  AI_DELIVERY_SIGNAL_TAXONOMY,
  CLARIFICATION_CONTEXT_VERSION,
  ML_SIGNAL_ALIASES,
  QUESTION_CATALOG_SEED,
  QUESTION_CATALOG_VERSION,
} from '../../../src/data/questionCatalogSeed2026_2.js';
import { QUESTION_CATALOG_REVIEW } from '../../../src/data/questionCatalogReview2026_2.js';
import {
  validateQuestionCatalogReview,
  validateQuestionCatalogSeed,
} from '../../../src/services/questions/questionCatalogService.js';
import { QUESTION_SELECTION_POLICY_REVIEW } from '../../../src/services/questions/questionCatalogPolicyReviewService.js';
import { approveQuestionCatalogVersion } from '../../../src/services/questions/questionCatalogRepository.js';
import { resolveQuestionScopeObservation } from '../../../src/services/voice/questionScopeClarificationService.js';

describe('question catalog 2026.2 and scope clarification enablement', () => {
  it('validates 2026.2 catalog seed schema, version, and governance review', () => {
    const seedValidation = validateQuestionCatalogSeed(QUESTION_CATALOG_SEED, { catalogVersion: QUESTION_CATALOG_VERSION });
    expect(QUESTION_CATALOG_VERSION).toBe('2026.2');
    expect(CLARIFICATION_CONTEXT_VERSION).toBe('2026.2.v1');
    expect(seedValidation).toEqual({ valid: true, errors: [] });

    const reviewValidation = validateQuestionCatalogReview({
      reviewRecord: QUESTION_CATALOG_REVIEW,
      catalogItems: QUESTION_CATALOG_SEED,
      aiDeliverySignalTaxonomy: AI_DELIVERY_SIGNAL_TAXONOMY,
      mlSignalAliases: ML_SIGNAL_ALIASES,
      catalogVersion: QUESTION_CATALOG_VERSION,
    });
    expect(reviewValidation).toEqual({ valid: true, errors: [] });
  });

  it('contains expected ambiguityMode policies and clarificationContext responses in 2026.2 seed', () => {
    const itemsByMode = QUESTION_CATALOG_SEED.reduce((acc, item) => {
      const mode = item.ambiguityPolicy?.mode || 'none';
      acc[mode] = (acc[mode] || 0) + 1;
      return acc;
    }, {});

    expect(itemsByMode.bounded_scenario).toBeGreaterThan(0);
    expect(itemsByMode.open_scope_probe).toBeGreaterThan(0);
    expect(itemsByMode.none).toBeGreaterThan(0);

    const openScopeProbeItem = QUESTION_CATALOG_SEED.find((item) => item.catalogQuestionId === 'ai_assisted_delivery');
    expect(openScopeProbeItem.ambiguityPolicy.mode).toBe('open_scope_probe');
    expect(openScopeProbeItem.clarificationContextVersion).toBe('2026.2.v1');
    expect(openScopeProbeItem.clarificationContext.responseText).toContain('Copilot');

    const boundedScenarioItem = QUESTION_CATALOG_SEED.find((item) => item.catalogQuestionId === 'coding_ownership_and_verification');
    expect(boundedScenarioItem.ambiguityPolicy.mode).toBe('bounded_scenario');
    expect(boundedScenarioItem.clarificationContextVersion).toBe('2026.2.v1');
    expect(boundedScenarioItem.clarificationContext.responseText).toContain('automated tests');
  });

  it('approves 2026.2 catalog version via repository layer when reviewer matches', async () => {
    const countDocuments = vi.fn().mockResolvedValue(QUESTION_CATALOG_SEED.length);
    const updateMany = vi.fn().mockResolvedValue({ modifiedCount: QUESTION_CATALOG_SEED.length });
    const model = { countDocuments, updateMany };

    const policyReviewRecord = {
      ...QUESTION_SELECTION_POLICY_REVIEW,
      policyVersion: QUESTION_CATALOG_VERSION,
    };

    const result = await approveQuestionCatalogVersion({
      catalogVersion: QUESTION_CATALOG_VERSION,
      reviewer: 'heminghan',
      reviewRecord: QUESTION_CATALOG_REVIEW,
      policyReviewRecord,
      catalogItems: QUESTION_CATALOG_SEED,
      aiDeliverySignalTaxonomy: AI_DELIVERY_SIGNAL_TAXONOMY,
      mlSignalAliases: ML_SIGNAL_ALIASES,
      model,
    });

    expect(countDocuments).toHaveBeenCalledWith(expect.objectContaining({
      catalogVersion: '2026.2',
      lifecycle: 'draft',
    }));
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ catalogVersion: '2026.2' }),
      expect.objectContaining({
        $set: expect.objectContaining({
          lifecycle: 'approved',
          'humanReview.reviewer': 'heminghan',
        }),
      }),
    );
    expect(result).toEqual({ modifiedCount: QUESTION_CATALOG_SEED.length });
  });

  it('enables valid scope clarification observations for active 2026.2 questions', () => {
    const openScopeItem = QUESTION_CATALOG_SEED.find((i) => i.catalogQuestionId === 'ai_assisted_delivery');
    const mockSession = {
      transcript: [
        {
          role: 'ai',
          questionId: 'q-2026-2-001',
          metadata: {
            countsAsQuestion: true,
            turnType: 'interview_question',
            preparedQuestionId: 'prep-2026-2-001',
            catalogQuestionId: openScopeItem.catalogQuestionId,
            ambiguityMode: openScopeItem.ambiguityPolicy.mode,
            clarificationContextVersion: openScopeItem.clarificationContextVersion,
            clarificationContext: openScopeItem.clarificationContext,
          },
        },
      ],
    };

    const scopeObservation = resolveQuestionScopeObservation({
      session: mockSession,
      candidateText: 'Should I focus on my daily Copilot use or team AI features?',
    });

    expect(scopeObservation.kind).toBe('scope_request');
    expect(scopeObservation.ambiguityMode).toBe('open_scope_probe');
    expect(scopeObservation.preparedQuestionId).toBe('prep-2026-2-001');
  });
});
