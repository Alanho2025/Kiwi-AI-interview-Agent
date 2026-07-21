import fs from 'node:fs/promises';
import path from 'node:path';

import { roundMetric } from './evaluationSummary.js';

const isCompletedReview = (review = {}) => Boolean(
  review?.status === 'completed'
  && Number.isFinite(review.score)
  && review.reviewerId
  && review.reviewedAt
  && review.rationale,
);

const isAuditableThresholdDecision = (decision = {}) => Boolean(
  decision.status === 'approved'
  && Number.isFinite(decision.value)
  && decision.reviewerIds?.length >= 2
  && decision.decidedAt
  && decision.rationale,
);

const buildSlices = (cases = [], disagreements = []) => {
  const slices = {};
  for (const calibrationCase of cases) {
    for (const [labelName, labelValue] of Object.entries(calibrationCase.labels || {})) {
      const sliceName = `${labelName}:${labelValue}`;
      if (slices[sliceName]) continue;
      const matchingCases = cases.filter((item) => item.labels?.[labelName] === labelValue);
      const reviewedCases = matchingCases.filter((item) => isCompletedReview(item.humanReview));
      const disagreementCount = disagreements.filter((item) => (
        item.labels?.[labelName] === labelValue
      )).length;
      slices[sliceName] = {
        totalCases: matchingCases.length,
        reviewedCases: reviewedCases.length,
        disagreementCount,
        disagreementRate: reviewedCases.length
          ? roundMetric(disagreementCount / reviewedCases.length)
          : 0,
      };
    }
  }
  return slices;
};

export const buildHumanCalibrationSummary = (dataset = {}) => {
  const cases = dataset.cases || [];
  const tolerance = Number(dataset.disagreementTolerance ?? 0.15);
  const reviewedCases = cases.filter((item) => isCompletedReview(item.humanReview));
  const disagreements = reviewedCases
    .map((item) => ({
      caseId: item.caseId,
      evaluationType: item.evaluationType,
      automatedScore: item.automatedScore,
      humanScore: item.humanReview.score,
      absoluteDifference: roundMetric(Math.abs(item.automatedScore - item.humanReview.score)),
      labels: item.labels || {},
      reviewerRationale: item.humanReview.rationale,
    }))
    .filter((item) => item.absoluteDifference > tolerance);
  const allCasesReviewed = cases.length > 0 && reviewedCases.length === cases.length;
  const thresholdDecision = dataset.thresholdDecision || { status: 'not_set', value: null };
  const canAssertNumericalReleaseThreshold = allCasesReviewed
    && isAuditableThresholdDecision(thresholdDecision);
  const status = canAssertNumericalReleaseThreshold
    ? 'calibrated'
    : allCasesReviewed
      ? 'review_complete_threshold_not_set'
      : 'pending_human_review';

  return {
    schemaVersion: 'human_calibration_report_v1',
    datasetVersion: dataset.datasetVersion,
    generatedAt: new Date().toISOString(),
    status,
    disagreementTolerance: tolerance,
    totalCases: cases.length,
    reviewedCases: reviewedCases.length,
    disagreements,
    slices: buildSlices(cases, disagreements),
    thresholdDecision,
    canAssertNumericalReleaseThreshold,
  };
};

const renderMarkdown = (summary = {}) => [
  '# Role-Fit Human Calibration',
  '',
  `- Dataset: ${summary.datasetVersion}`,
  `- Status: ${summary.status}`,
  `- Reviewed: ${summary.reviewedCases}/${summary.totalCases}`,
  `- Disagreements: ${summary.disagreements.length}`,
  `- Threshold decision: ${summary.thresholdDecision.status}`,
  `- Numerical threshold may be asserted: ${summary.canAssertNumericalReleaseThreshold ? 'yes' : 'no'}`,
  '',
  'No numerical release threshold is valid until every sampled case has an auditable human review and the threshold decision has two named reviewer IDs, a date, and a rationale.',
].join('\n');

export const runHumanCalibrationEvaluation = async ({ datasetPath, reportRoot } = {}) => {
  const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const summary = buildHumanCalibrationSummary(dataset);
  if (reportRoot) {
    await fs.mkdir(reportRoot, { recursive: true });
    await fs.writeFile(path.join(reportRoot, 'human-calibration-eval.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'human-calibration-eval.latest.md'), `${renderMarkdown(summary)}\n`);
  }
  return summary;
};
