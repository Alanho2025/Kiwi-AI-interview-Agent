import fs from 'node:fs/promises';
import path from 'node:path';

import { buildHumanCalibrationSummary } from './humanCalibrationEvaluator.js';

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const requiredCaseFields = [
  'caseId',
  'riskArea',
  'inputArtifact',
  'attack',
  'expectedSafeguard',
  'expectedStatus',
  'assertions',
];

const hasRequiredCaseShape = (evaluationCase = {}) => requiredCaseFields.every((field) => {
  if (field === 'assertions') return Array.isArray(evaluationCase.assertions) && evaluationCase.assertions.length > 0;
  return Boolean(evaluationCase[field]);
});

const summarizeCoverage = (cases = []) => {
  const riskAreas = unique(cases.map((item) => item.riskArea));
  const expectedStatuses = unique(cases.map((item) => item.expectedStatus));
  return {
    riskAreas,
    expectedStatuses,
    highRiskCount: cases.filter((item) => item.labels?.risk === 'high').length,
  };
};

const buildCalibrationGate = (calibrationSummary = {}) => {
  const releaseThreshold = Number.isFinite(calibrationSummary.thresholdDecision?.value)
    ? calibrationSummary.thresholdDecision.value
    : null;
  return {
    calibrationStatus: calibrationSummary.status || 'missing',
    calibrationReviewedCases: Number(calibrationSummary.reviewedCases || 0),
    releaseThreshold,
    calibrationCanAssertThreshold: calibrationSummary.canAssertNumericalReleaseThreshold === true,
  };
};

export const evaluateRoleFitV2AdversarialDataset = (dataset = {}, { calibrationSummary = {} } = {}) => {
  const cases = Array.isArray(dataset.cases) ? dataset.cases : [];
  const malformedCaseIds = cases
    .filter((item) => !hasRequiredCaseShape(item))
    .map((item) => item.caseId || 'unknown_case');
  const coverage = summarizeCoverage(cases);
  const calibrationGate = buildCalibrationGate(calibrationSummary);
  const datasetChecksPassed = dataset.schemaVersion === 'role_fit_v2_adversarial_dataset_v1'
    && dataset.datasetVersion === 'role-fit-v2-adversarial-v1'
    && cases.length >= 12
    && malformedCaseIds.length === 0
    && coverage.riskAreas.length >= 8;
  const productionClaimAllowed = datasetChecksPassed && calibrationGate.calibrationCanAssertThreshold;

  return {
    schemaVersion: 'role_fit_v2_adversarial_eval_report_v1',
    datasetVersion: dataset.datasetVersion || '',
    totalCases: cases.length,
    datasetChecksPassed,
    malformedCaseIds,
    coverage,
    ...calibrationGate,
    productionClaimAllowed,
    productionClaimBlocker: productionClaimAllowed ? null : 'human_calibration_pending',
  };
};

const renderMarkdown = (summary = {}) => [
  '# Role-Fit V2 Adversarial Evaluation',
  '',
  `- Dataset: ${summary.datasetVersion}`,
  `- Cases: ${summary.totalCases}`,
  `- Dataset checks passed: ${summary.datasetChecksPassed ? 'yes' : 'no'}`,
  `- Risk areas: ${(summary.coverage?.riskAreas || []).join(', ')}`,
  `- Calibration status: ${summary.calibrationStatus}`,
  `- Calibration reviewed cases: ${summary.calibrationReviewedCases}`,
  `- Release threshold: ${summary.releaseThreshold ?? 'not set'}`,
  `- Production claim allowed: ${summary.productionClaimAllowed ? 'yes' : 'no'}`,
  `- Production claim blocker: ${summary.productionClaimBlocker || 'none'}`,
  '',
  'This deterministic suite checks mock-safe adversarial coverage for Role-Fit Closed Loop v2. It does not call real AI providers. A production numerical threshold is valid only when the paired human calibration report is fully reviewed and auditable.',
].join('\n');

export const runRoleFitV2AdversarialEvaluation = async ({
  datasetPath,
  calibrationDatasetPath = '',
  reportRoot,
} = {}) => {
  const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const calibrationSummary = calibrationDatasetPath
    ? buildHumanCalibrationSummary(JSON.parse(await fs.readFile(calibrationDatasetPath, 'utf8')))
    : {};
  const summary = evaluateRoleFitV2AdversarialDataset(dataset, { calibrationSummary });
  if (reportRoot) {
    await fs.mkdir(reportRoot, { recursive: true });
    await fs.writeFile(path.join(reportRoot, 'role-fit-v2-adversarial.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'role-fit-v2-adversarial.latest.md'), `${renderMarkdown(summary)}\n`);
  }
  return summary;
};
