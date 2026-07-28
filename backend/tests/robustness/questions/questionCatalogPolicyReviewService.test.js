import { describe, expect, it } from 'vitest';

import {
  buildQuestionSelectionPolicyDigest,
  QUESTION_SELECTION_POLICY_REVIEW,
  validateQuestionSelectionPolicyReview,
} from '../../../src/services/questions/questionCatalogPolicyReviewService.js';
import { buildVoiceSelectionPolicyReviewSnapshot } from '../../../src/services/questions/questionCatalogPolicyReviewDocumentService.js';

describe('Voice selection policy human review governance', () => {
  it('requires a complete, digest-bound Product Owner decision', () => {
    const policySnapshot = buildVoiceSelectionPolicyReviewSnapshot();
    const pendingReview = {
      ...QUESTION_SELECTION_POLICY_REVIEW,
      approvedPolicyDigest: null,
      decision: 'pending',
      reviewer: null,
      decidedAt: null,
      decisionReason: 'Awaiting Product Owner review.',
      reviewedScenarioIds: [],
    };

    expect(validateQuestionSelectionPolicyReview({
      reviewRecord: QUESTION_SELECTION_POLICY_REVIEW,
      policySnapshot,
    })).toEqual({ valid: true, errors: [] });
    expect(validateQuestionSelectionPolicyReview({
      reviewRecord: pendingReview,
      policySnapshot,
    })).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining(['selection_policy_review_not_approved']),
    }));

    const changedPolicySnapshot = {
      ...policySnapshot,
      scenarios: policySnapshot.scenarios.map((scenario, index) => (
        index === 0
          ? { ...scenario, requiredCoverageSlots: [] }
          : scenario
      )),
    };
    expect(buildQuestionSelectionPolicyDigest(changedPolicySnapshot))
      .not.toBe(QUESTION_SELECTION_POLICY_REVIEW.candidatePolicyDigest);
    expect(validateQuestionSelectionPolicyReview({
      reviewRecord: QUESTION_SELECTION_POLICY_REVIEW,
      policySnapshot: changedPolicySnapshot,
    })).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining(['selection_policy_review_digest_mismatch']),
    }));

    expect(validateQuestionSelectionPolicyReview({
      reviewRecord: {
        ...QUESTION_SELECTION_POLICY_REVIEW,
        reviewedScenarioIds: QUESTION_SELECTION_POLICY_REVIEW.reviewedScenarioIds.slice(1),
      },
      policySnapshot,
    })).toEqual(expect.objectContaining({
      valid: false,
      errors: expect.arrayContaining(['selection_policy_review_scenario_set_incomplete']),
    }));
  });
});
