import { describe, expect, it, vi } from 'vitest';

import {
  AI_DELIVERY_SIGNAL_TAXONOMY,
  ML_SIGNAL_ALIASES,
  QUESTION_CATALOG_SEED,
  QUESTION_CATALOG_VERSION,
} from '../../../src/data/questionCatalogSeed2026_1.js';
import { QUESTION_CATALOG_REVIEW } from '../../../src/data/questionCatalogReview2026_1.js';
import {
  buildQuestionCatalogSeedUpserts,
  resolveAiDeliverySignalProfile,
  validateQuestionCatalogReview,
  validateQuestionCatalogSeed,
} from '../../../src/services/questions/questionCatalogService.js';
import { QUESTION_SELECTION_POLICY_REVIEW } from '../../../src/services/questions/questionCatalogPolicyReviewService.js';
import { approveQuestionCatalogVersion } from '../../../src/services/questions/questionCatalogRepository.js';

describe('question catalog seed and AI-delivery taxonomy', () => {
  it('ships a reviewable, no-PII 2026.1 catalog that covers the requested families', () => {
    const validation = validateQuestionCatalogSeed(QUESTION_CATALOG_SEED);
    const ids = QUESTION_CATALOG_SEED.map((item) => item.catalogQuestionId);

    expect(QUESTION_CATALOG_VERSION).toBe('2026.1');
    expect(validation).toEqual({ valid: true, errors: [] });
    expect(ids).toEqual(expect.arrayContaining([
      'company_role_internship_motivation',
      'group_failure_learning',
      'learning_agility_self_teach',
      'initiative_value_creation',
      'support_struggling_teammate',
      'career_transition_hardware_to_ai_solution',
      'role_motivation_ai_solution',
      'ai_assisted_delivery',
      'prompt_and_context_design',
      'proud_project',
      'underperforming_project_reflection',
      'conflict_resolution',
      'nz_study_work_motivation',
      'coding_ownership_and_verification',
      'ml_problem_framing',
      'ml_data_and_evaluation',
      'ml_delivery_and_monitoring',
    ]));
    expect(AI_DELIVERY_SIGNAL_TAXONOMY.some((item) => item.canonicalKey === 'coding_assistant_or_agent')).toBe(true);
    QUESTION_CATALOG_SEED.forEach((item) => {
      const coveredLevels = new Set(item.promptVariants.flatMap((variant) => variant.targetLevels || []));
      expect([...coveredLevels].sort()).toEqual(['intermediate', 'junior', 'senior']);
    });
  });

  it('stores governed alias metadata for every maintained AI-delivery keyword', () => {
    AI_DELIVERY_SIGNAL_TAXONOMY.forEach((signal) => {
      expect(signal).toMatchObject({
        lifecycle: 'active',
        lastReviewedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        sources: expect.arrayContaining([expect.stringMatching(/^https:\/\//)]),
      });
      expect(Object.keys(signal.aliasGovernance).sort()).toEqual([...signal.aliases].sort());
      signal.aliases.forEach((alias) => {
        expect(signal.aliasGovernance[alias]).toMatchObject({
          lifecycle: 'active',
          lastReviewedAt: signal.lastReviewedAt,
          sources: signal.sources,
        });
      });
    });
  });

  it('requires AI and ML questions to carry level variants, research provenance, and a not-eligible counterexample', () => {
    const aiAndMlItems = QUESTION_CATALOG_SEED.filter((item) => (
      item.questionType.startsWith('ai_') || item.questionType.startsWith('ml_')
    ));

    aiAndMlItems.forEach((item) => {
      const coveredLevels = new Set(item.promptVariants.flatMap((variant) => variant.targetLevels || []));
      expect([...coveredLevels].sort()).toEqual(['intermediate', 'junior', 'senior']);
      expect(item.notEligibleExamples).toEqual(expect.arrayContaining([expect.any(String)]));
      expect(item.researchBasis).toMatchObject({
        reviewedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        sources: expect.arrayContaining([
          expect.stringMatching(/^https:\/\//),
          expect.stringMatching(/^https:\/\//),
        ]),
      });
    });
  });

  it('rejects an AI/ML seed entry when governance evidence is removed', () => {
    const item = QUESTION_CATALOG_SEED.find((entry) => entry.catalogQuestionId === 'ai_assisted_delivery');
    const validation = validateQuestionCatalogSeed([{
      ...item,
      notEligibleExamples: [],
      researchBasis: { reviewedAt: '', sources: [] },
    }]);

    expect(validation.valid).toBe(false);
    expect(validation.errors).toEqual(expect.arrayContaining([
      'ai_assisted_delivery:missing_not_eligible_example',
      'ai_assisted_delivery:missing_research_review_date',
      'ai_assisted_delivery:insufficient_research_sources',
    ]));
  });

  it('recognises the maintained coding-agent, tool and provider families without letting one provider name over-trigger', () => {
    const explicit = resolveAiDeliverySignalProfile({
      text: 'Build a Claude Code workflow using MCP tool calling and evaluate the deployed agent.',
    });
    const providerOnly = resolveAiDeliverySignalProfile({ text: 'Experience with Azure OpenAI is a bonus.' });

    expect(explicit).toEqual(expect.objectContaining({ explicitAiDelivery: true }));
    expect(explicit.matchedSignals.map((item) => item.canonicalKey)).toEqual(expect.arrayContaining([
      'coding_assistant_or_agent',
      'tool_interoperability_pattern',
      'evaluation_observability_safety',
    ]));
    expect(providerOnly).toEqual(expect.objectContaining({
      explicitAiDelivery: false,
      strongestSignal: 'medium',
    }));
  });

  it('keeps ML detection separate from AI-tool naming', () => {
    const aiToolOnly = resolveAiDeliverySignalProfile({ text: 'Use GitHub Copilot to help review pull requests.' });
    const ml = resolveAiDeliverySignalProfile({ text: 'Build and monitor a machine learning model for demand forecasting.' });

    expect(aiToolOnly.hasMlSignal).toBe(false);
    expect(ml.hasMlSignal).toBe(true);
  });

  it('builds version-scoped global upserts without session or candidate fields', () => {
    const upserts = buildQuestionCatalogSeedUpserts(QUESTION_CATALOG_SEED);

    expect(upserts).toHaveLength(QUESTION_CATALOG_SEED.length);
    expect(upserts[0]).toEqual(expect.objectContaining({
      updateOne: expect.objectContaining({
        filter: expect.objectContaining({ catalogVersion: QUESTION_CATALOG_VERSION }),
        update: expect.objectContaining({ $setOnInsert: expect.not.objectContaining({ userId: expect.anything(), sessionId: expect.anything() }) }),
      }),
    }));
  });

  it('rejects raw CV/JD content fields from the global catalog contract', () => {
    const validation = validateQuestionCatalogSeed([{
      ...QUESTION_CATALOG_SEED[0],
      rawJobDescription: 'Private JD text must stay in the session snapshot.',
    }]);

    expect(validation).toEqual({
      valid: false,
      errors: ['company_role_internship_motivation:contains_candidate_or_session_field'],
    });
  });

  it('requires an approved, version-complete human review record before activation', async () => {
    const reviewedCatalogQuestionIds = QUESTION_CATALOG_SEED.map((item) => item.catalogQuestionId);
    const pendingReview = {
      ...QUESTION_CATALOG_REVIEW,
      approvedCatalogDigest: null,
      decision: 'pending',
      reviewer: null,
      decidedAt: null,
      decisionReason: 'Awaiting Product Owner review.',
      reviewedCatalogQuestionIds: [],
    };
    const pendingPolicyReview = {
      ...QUESTION_SELECTION_POLICY_REVIEW,
      approvedPolicyDigest: null,
      decision: 'pending',
      reviewer: null,
      decidedAt: null,
      decisionReason: 'Awaiting Product Owner review.',
      reviewedScenarioIds: [],
    };
    const model = {
      countDocuments: vi.fn().mockResolvedValue(reviewedCatalogQuestionIds.length),
      updateMany: vi.fn().mockResolvedValue({
        matchedCount: reviewedCatalogQuestionIds.length,
        modifiedCount: reviewedCatalogQuestionIds.length,
      }),
    };

    await expect(approveQuestionCatalogVersion({ model, reviewer: '' })).rejects.toThrow('QUESTION_CATALOG_REVIEWER');
    expect(model.updateMany).not.toHaveBeenCalled();

    expect(validateQuestionCatalogReview({
      reviewRecord: QUESTION_CATALOG_REVIEW,
      catalogItems: QUESTION_CATALOG_SEED,
    })).toEqual({ valid: true, errors: [] });
    expect(validateQuestionCatalogReview({
      reviewRecord: pendingReview,
      catalogItems: QUESTION_CATALOG_SEED,
    })).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining(['catalog_review_not_approved']),
    }));
    await expect(approveQuestionCatalogVersion({
      model,
      reviewer: 'heminghan',
      reviewRecord: pendingReview,
    })).rejects.toThrow('approved human review record');
    expect(model.updateMany).not.toHaveBeenCalled();

    expect(validateQuestionCatalogReview({
      reviewRecord: QUESTION_CATALOG_REVIEW,
      catalogItems: QUESTION_CATALOG_SEED.map((item, index) => (
        index === 0 ? { ...item, competency: 'changed_after_review' } : item
      )),
    })).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining(['catalog_review_digest_mismatch']),
    }));

    expect(validateQuestionCatalogReview({
      reviewRecord: QUESTION_CATALOG_REVIEW,
      catalogItems: QUESTION_CATALOG_SEED,
      aiDeliverySignalTaxonomy: AI_DELIVERY_SIGNAL_TAXONOMY.map((entry, index) => (
        index === 0 ? { ...entry, strength: 'weak' } : entry
      )),
      mlSignalAliases: ML_SIGNAL_ALIASES,
    })).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining(['catalog_review_digest_mismatch']),
    }));

    expect(validateQuestionCatalogReview({
      reviewRecord: QUESTION_CATALOG_REVIEW,
      catalogItems: QUESTION_CATALOG_SEED,
      aiDeliverySignalTaxonomy: AI_DELIVERY_SIGNAL_TAXONOMY,
      mlSignalAliases: [...ML_SIGNAL_ALIASES, 'unreviewed ml alias'],
    })).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining(['catalog_review_digest_mismatch']),
    }));

    expect(validateQuestionCatalogReview({
      reviewRecord: {
        ...QUESTION_CATALOG_REVIEW,
        governanceScope: ['question_catalog_items'],
        candidateCatalogDigest: 'stale-human-review-digest',
      },
      catalogItems: QUESTION_CATALOG_SEED,
    })).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining([
        'catalog_review_governance_scope_incomplete',
        'catalog_review_candidate_digest_mismatch',
        'catalog_review_approved_digest_mismatch',
      ]),
    }));

    await expect(approveQuestionCatalogVersion({
      model,
      catalogVersion: QUESTION_CATALOG_VERSION,
      reviewer: 'heminghan',
      reviewRecord: QUESTION_CATALOG_REVIEW,
      policyReviewRecord: pendingPolicyReview,
    })).rejects.toThrow('approved Voice selection policy review record');
    expect(model.countDocuments).not.toHaveBeenCalled();

    await expect(approveQuestionCatalogVersion({
      model,
      catalogVersion: QUESTION_CATALOG_VERSION,
      reviewer: 'heminghan',
      reviewRecord: QUESTION_CATALOG_REVIEW,
      policyReviewRecord: QUESTION_SELECTION_POLICY_REVIEW,
    })).resolves.toEqual({
      matchedCount: reviewedCatalogQuestionIds.length,
      modifiedCount: reviewedCatalogQuestionIds.length,
    });

    expect(model.updateMany).toHaveBeenCalledWith(
      {
        catalogVersion: QUESTION_CATALOG_VERSION,
        catalogQuestionId: { $in: reviewedCatalogQuestionIds },
        lifecycle: 'draft',
        'humanReview.decision': 'pending',
      },
      {
        $set: expect.objectContaining({
          lifecycle: 'approved',
          'humanReview.reviewer': 'heminghan',
          'humanReview.decision': 'approved',
          'humanReview.approvedAt': expect.any(Date),
          'humanReview.decisionReason': QUESTION_CATALOG_REVIEW.decisionReason,
        }),
      },
    );
  });
});
