import fs from 'node:fs/promises';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { evaluateRoleFitV2AdversarialDataset } from '../../../eval/helpers/roleFitV2AdversarialEvaluator.js';
import { buildHumanCalibrationSummary } from '../../../eval/helpers/humanCalibrationEvaluator.js';

const loadDataset = async (relativePath) => JSON.parse(await fs.readFile(
  path.resolve('eval/datasets', relativePath),
  'utf8',
));

const loadManualReviewDataset = async (relativePath) => JSON.parse(await fs.readFile(
  path.resolve('eval/manual-review', relativePath),
  'utf8',
));

describe('role-fit evaluation datasets', () => {
  it.each([
    ['rag-grounding/runtime-retrieval-v1.json', 'retrieval_dataset_v1', 'role-fit-retrieval-v1'],
    ['rag-grounding/generation-grounding-v1.json', 'generation_grounding_dataset_v1', 'role-fit-generation-v1'],
    ['e2e-agent-trajectory/runtime-trajectory-v1.json', 'trajectory_dataset_v1', 'role-fit-trajectory-v1'],
  ])('keeps %s versioned and synthetic', async (datasetPath, schemaVersion, datasetVersion) => {
    const dataset = await loadDataset(datasetPath);
    const serialized = JSON.stringify(dataset).toLowerCase();

    expect(dataset).toMatchObject({ schemaVersion, datasetVersion });
    expect(dataset.cases.length).toBeGreaterThanOrEqual(4);
    expect(dataset.cases.every((item) => item.caseId && item.labels?.domain && item.labels?.risk)).toBe(true);
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('heminghan');
    expect(serialized).not.toContain('kiwi-ai-interview-agent/uploads');
  });

  it('defines claim-level source policy for generation grounding', async () => {
    const dataset = await loadDataset('rag-grounding/generation-grounding-v1.json');

    expect(dataset.cases.every((item) => item.reference?.claimSourcePolicy)).toBe(true);
    expect(dataset.cases.flatMap((item) => item.output?.claims || []).every((claim) => claim.claimClass)).toBe(true);
  });

  it('defines expected runtime action, tool, args, observation, terminal state, and latency', async () => {
    const dataset = await loadDataset('e2e-agent-trajectory/runtime-trajectory-v1.json');

    for (const evaluationCase of dataset.cases) {
      expect(evaluationCase).toEqual(expect.objectContaining({
        state: expect.any(Object),
        allowedActions: expect.any(Array),
        expectedAction: expect.any(String),
        expectedTool: expect.any(String),
        expectedArgs: expect.any(Object),
        expectedObservationClass: expect.any(String),
        latencyBudgetMs: expect.any(Number),
      }));
      expect(Object.hasOwn(evaluationCase, 'expectedTerminalCondition')).toBe(true);
    }
  });

  it('keeps the Role-Fit V2 adversarial suite at 12 mock-safe cases with explicit safeguards', async () => {
    const dataset = await loadDataset('role-fit-v2/adversarial-v1.json');
    const summary = evaluateRoleFitV2AdversarialDataset(dataset);
    const serialized = JSON.stringify(dataset).toLowerCase();

    expect(dataset).toMatchObject({
      schemaVersion: 'role_fit_v2_adversarial_dataset_v1',
      datasetVersion: 'role-fit-v2-adversarial-v1',
    });
    expect(dataset.cases).toHaveLength(12);
    expect(dataset.cases.every((item) => (
      item.caseId
      && item.riskArea
      && item.expectedSafeguard
      && item.expectedStatus
      && item.assertions?.length
    ))).toBe(true);
    expect(summary).toMatchObject({
      schemaVersion: 'role_fit_v2_adversarial_eval_report_v1',
      totalCases: 12,
      datasetChecksPassed: true,
      productionClaimAllowed: false,
      productionClaimBlocker: 'human_calibration_pending',
    });
    expect(serialized).not.toContain('@');
    expect(serialized).not.toContain('heminghan');
    expect(serialized).not.toContain('/uploads');
  });

  it('keeps human calibration as an explicit pending release gate unless reviewed records exist', async () => {
    const dataset = await loadManualReviewDataset('role-fit-calibration-v1.json');
    const summary = buildHumanCalibrationSummary(dataset);

    expect(dataset.cases).toHaveLength(12);
    if (summary.reviewedCases > 0) {
      expect(['calibrated', 'review_complete_threshold_not_set']).toContain(summary.status);
    } else {
      expect(summary).toMatchObject({
        status: 'pending_human_review',
        totalCases: 12,
        reviewedCases: 0,
        canAssertNumericalReleaseThreshold: false,
      });
    }
  });
});
