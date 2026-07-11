import { describe, expect, it } from 'vitest';

import { buildHumanCalibrationSummary } from '../../../eval/helpers/humanCalibrationEvaluator.js';

const caseRecord = {
  caseId: 'candidate_api_evidence',
  evaluationType: 'generation_grounding',
  automatedScore: 1,
  labels: { domain: 'backend', risk: 'high' },
  humanReview: null,
};

describe('human calibration evaluator', () => {
  it('does not assert numerical release thresholds while human review is pending', () => {
    const summary = buildHumanCalibrationSummary({
      schemaVersion: 'human_calibration_dataset_v1',
      datasetVersion: 'role-fit-calibration-v1',
      disagreementTolerance: 0.15,
      thresholdDecision: { status: 'not_set', value: null },
      cases: [caseRecord],
    });

    expect(summary).toMatchObject({
      status: 'pending_human_review',
      reviewedCases: 0,
      totalCases: 1,
      disagreements: [],
      canAssertNumericalReleaseThreshold: false,
      thresholdDecision: { status: 'not_set', value: null },
    });
  });

  it('records per-slice human-vs-judge disagreements', () => {
    const summary = buildHumanCalibrationSummary({
      schemaVersion: 'human_calibration_dataset_v1',
      datasetVersion: 'role-fit-calibration-v1',
      disagreementTolerance: 0.15,
      thresholdDecision: { status: 'not_set', value: null },
      cases: [{
        ...caseRecord,
        humanReview: {
          status: 'completed',
          score: 0.6,
          reviewerId: 'reviewer-1',
          reviewedAt: '2026-07-10T00:00:00.000Z',
          rationale: 'The claim is grounded but misses a required qualification.',
        },
      }],
    });

    expect(summary.status).toBe('review_complete_threshold_not_set');
    expect(summary.disagreements).toEqual([expect.objectContaining({
      caseId: 'candidate_api_evidence',
      absoluteDifference: 0.4,
    })]);
    expect(summary.slices['risk:high']).toMatchObject({
      reviewedCases: 1,
      disagreementCount: 1,
      disagreementRate: 1,
    });
    expect(summary.canAssertNumericalReleaseThreshold).toBe(false);
  });

  it('allows a threshold only after every case is reviewed and the decision is auditable', () => {
    const summary = buildHumanCalibrationSummary({
      schemaVersion: 'human_calibration_dataset_v1',
      datasetVersion: 'role-fit-calibration-v1',
      disagreementTolerance: 0.15,
      thresholdDecision: {
        status: 'approved',
        value: 0.85,
        reviewerIds: ['reviewer-1', 'reviewer-2'],
        decidedAt: '2026-07-10T01:00:00.000Z',
        rationale: 'Reviewed all slices and retained a conservative failure boundary.',
      },
      cases: [{
        ...caseRecord,
        humanReview: {
          status: 'completed',
          score: 0.95,
          reviewerId: 'reviewer-1',
          reviewedAt: '2026-07-10T00:00:00.000Z',
          rationale: 'Claims and source class are correct.',
        },
      }],
    });

    expect(summary.status).toBe('calibrated');
    expect(summary.canAssertNumericalReleaseThreshold).toBe(true);
  });
});
