import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import {
  buildVoiceSelectionPolicyReviewSnapshot,
  renderVoiceSelectionPolicyReviewMarkdown,
} from '../../../src/services/questions/questionCatalogPolicyReviewDocumentService.js';
import { QUESTION_SELECTION_POLICY_REVIEW } from '../../../src/services/questions/questionCatalogPolicyReviewService.js';

const REVIEW_DOCUMENT_URL = new URL(
  '../../../../docs/question_refine/reviews/cp2-voice-selection-policy-full-review.md',
  import.meta.url,
);

describe('Voice selection policy human review document', () => {
  it('renders the executable role, level, count, eligibility, coverage, and follow-up matrix', () => {
    const snapshot = buildVoiceSelectionPolicyReviewSnapshot();
    const scenarioById = Object.fromEntries(snapshot.scenarios.map((scenario) => [scenario.scenarioId, scenario]));

    expect(scenarioById.software_junior_8.requiredCoverageSlots).toEqual(['software_ai_workflow']);
    expect(scenarioById.data_intermediate_15.requiredCoverageSlots).toEqual(['software_ai_workflow']);
    expect(scenarioById.ai_solution_senior_8.requiredCoverageSlots).toEqual([
      'ai_solution_delivery',
      'ai_solution_second_family',
    ]);
    expect(scenarioById.provider_only_software_8).toMatchObject({
      explicitAiDelivery: false,
      requiredCoverageSlots: ['software_ai_workflow'],
    });
    expect(scenarioById.ml_intermediate_15.requiredCoverageSlots).toEqual(['ml_foundation']);
    expect(scenarioById.ml_senior_15.requiredCoverageSlots).toEqual(['ml_foundation', 'ml_operations']);
    expect(scenarioById.non_tech_no_signal_8).toMatchObject({
      aiJudgementEligibility: 'ai_or_digital_signal_not_confirmed',
      requiredCoverageSlots: [],
    });
    expect(scenarioById.non_tech_ai_signal_8).toMatchObject({
      aiJudgementEligibility: 'eligible_optional',
      requiredCoverageSlots: [],
    });
    expect(scenarioById.software_senior_5.requiredCoverageSlots).toEqual([]);

    expect(snapshot.followUpComparisons.map((comparison) => comparison.decision)).toEqual([
      'next_root',
      'follow_up',
    ]);
  });

  it('keeps the checked-in policy artifact byte-for-byte aligned with executable policy output', () => {
    const checkedInDocument = fs.readFileSync(REVIEW_DOCUMENT_URL, 'utf8');

    expect(checkedInDocument).toBe(renderVoiceSelectionPolicyReviewMarkdown({
      policyReviewRecord: QUESTION_SELECTION_POLICY_REVIEW,
    }));
  });
});
