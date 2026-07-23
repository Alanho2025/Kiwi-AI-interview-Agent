import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { BLOCKING_REPORT_FLAGS } from '../../src/services/agents/reportQaAgent.js';
import { buildReportPublicationDecision } from '../../src/services/harness/reportPublicationPolicy.js';
import {
  buildReportWorkflowRun,
  runReportTaskWithHarness,
} from '../../src/services/harness/reportWorkflowHarness.js';
import { validateHarnessWorkflowRun } from '../../src/services/harness/harnessWorkflowRunContract.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceRoot = path.resolve(backendRoot, '../docs/harness/evidence');
const evaluatedAt = '2026-07-15T12:00:00.000Z';

const session = {
  id: 'm4-report-session-001',
  userId: 'm4-report-user-001',
  mode: 'text',
  cvFileId: 'm4-cv-001',
  jdFingerprint: 'm4-jd-001',
  transcript: [{ role: 'user', text: 'private candidate evidence that must not enter the harness artifact' }],
  interviewPlan: { schemaVersion: 'interview-plan-v2' },
};

const evaluateCase = ({ id, qaResult, repairHistory = [], expectedGate, expectedPublication }) => {
  const decision = buildReportPublicationDecision({
    workflowRunId: `m4-${id}`,
    executionMode: 'observe',
    qaResult,
    repairHistory,
    evaluatedAt,
  });
  assert.equal(decision.gateResult.status, expectedGate);
  assert.equal(decision.publicationStatus, expectedPublication);
  assert.equal(decision.gateResult.enforced, false);
  return {
    id,
    qualityFlags: qaResult.qualityFlags || [],
    gateStatus: decision.gateResult.status,
    publicationStatus: decision.publicationStatus,
    enforced: decision.gateResult.enforced,
    repairLineage: decision.repairLineage,
    passed: true,
  };
};

const main = async () => {
  const criticalResults = [...BLOCKING_REPORT_FLAGS].map((flag) => evaluateCase({
    id: `critical_${flag}`,
    qaResult: { passed: false, qualityFlags: [flag] },
    expectedGate: 'block',
    expectedPublication: 'needs_review',
  }));
  const criticalFalseNegativeCount = criticalResults.filter((item) => item.gateStatus !== 'block').length;
  assert.equal(criticalFalseNegativeCount, 0);

  const representativeResults = [
    evaluateCase({
      id: 'unsupported_high_confidence_claim',
      qaResult: { passed: false, qualityFlags: ['unsupported_high_confidence_feedback'] },
      expectedGate: 'review',
      expectedPublication: 'needs_review',
    }),
    evaluateCase({
      id: 'qa_pass',
      qaResult: { passed: true, qualityFlags: [] },
      expectedGate: 'pass',
      expectedPublication: 'ready',
    }),
    evaluateCase({
      id: 'legacy_inline_repair',
      qaResult: { passed: true, qualityFlags: [] },
      repairHistory: [{
        attempt: 1,
        status: 'repaired',
        startedAt: '2026-07-15T12:00:00.100Z',
        completedAt: '2026-07-15T12:00:00.900Z',
      }],
      expectedGate: 'pass',
      expectedPublication: 'ready_after_repair',
    }),
  ];
  const legacyRepair = representativeResults.find((item) => item.id === 'legacy_inline_repair');
  assert.equal(legacyRepair.repairLineage.legacyInlineRepairObserved, true);
  assert.equal(legacyRepair.repairLineage.explicitRepairActionCount, 1);
  assert.equal(legacyRepair.repairLineage.explicitRepairActionsComplete, true);
  assert.equal(legacyRepair.repairLineage.explicitRepairLineageComplete, true);
  assert.equal(legacyRepair.repairLineage.explicitChildRunsComplete, false);

  const explicitRepairRun = buildReportWorkflowRun({
    workflowRunId: 'm4-explicit-repair-run',
    executionMode: 'observe',
    taskType: 'generate_report',
    session,
    result: {
      report: { summary: 'private repaired report payload' },
      qaResult: { passed: true, qualityFlags: [] },
      repairHistory: [{
        attempt: 1,
        status: 'repaired',
        repairInstruction: 'private repair instruction',
        qaBefore: {
          passed: false,
          qualityFlags: ['missing_actionable_coaching'],
          privateDetail: 'private QA detail',
        },
        qaAfter: { passed: true, qualityFlags: [] },
        startedAt: '2026-07-15T12:00:00.100Z',
        completedAt: '2026-07-15T12:00:00.900Z',
      }],
      stored: { latestStatus: 'ready_after_repair' },
    },
    startedAt: evaluatedAt,
    completedAt: '2026-07-15T12:00:01.000Z',
  });
  const explicitRepairValidation = validateHarnessWorkflowRun(explicitRepairRun);
  assert.equal(explicitRepairValidation.valid, true, explicitRepairValidation.errors.join('; '));
  assert.equal(explicitRepairRun.actionContracts.filter((action) => (
    action.actionType === 'REPAIR_REPORT_DRAFT'
  )).length, 1);
  assert.equal(explicitRepairRun.gateResults.some((gate) => (
    gate.gateType === 'report_repair_attempt_verified' && gate.status === 'pass'
  )), true);
  const serializedExplicitRepairRun = JSON.stringify(explicitRepairRun);
  assert.equal(serializedExplicitRepairRun.includes('private repair instruction'), false);
  assert.equal(serializedExplicitRepairRun.includes('private QA detail'), false);
  assert.equal(serializedExplicitRepairRun.includes('private repaired report payload'), false);

  const qaOnlyRun = buildReportWorkflowRun({
    workflowRunId: 'm4-qa-only-run',
    executionMode: 'observe',
    taskType: 'qa_report',
    session,
    observation: { qaResult: { passed: false, qualityFlags: ['missing_actionable_coaching'] } },
    result: {
      qaResult: { passed: false, qualityFlags: ['missing_actionable_coaching'] },
      stored: { latestStatus: 'needs_review' },
    },
    startedAt: evaluatedAt,
    completedAt: '2026-07-15T12:00:01.000Z',
  });
  const qaOnlyValidation = validateHarnessWorkflowRun(qaOnlyRun);
  assert.equal(qaOnlyValidation.valid, true, qaOnlyValidation.errors.join('; '));
  assert.equal(qaOnlyRun.actionContracts[0].actionType, 'QA_REPORT');
  assert.equal(qaOnlyRun.actionContracts[0].repairLineage.attemptCount, 0);

  const productResult = {
    report: { summary: 'private report result that must remain product-owned' },
    qaResult: { passed: false, qualityFlags: ['alignment_claim_not_grounded'] },
    repairHistory: [],
    stored: { latestStatus: 'needs_review' },
  };
  let persistedRun = null;
  const wrapperResult = await runReportTaskWithHarness({
    enabled: true,
    executionMode: 'observe',
    taskType: 'generate_report',
    session,
    executeController: async () => productResult,
    appendRun: async (run) => { persistedRun = run; },
    workflowRunIdFactory: () => 'm4-product-parity-run',
    now: (() => {
      const values = [evaluatedAt, '2026-07-15T12:00:02.000Z'];
      let index = 0;
      return () => new Date(values[index++]);
    })(),
  });
  assert.equal(wrapperResult, productResult);
  assert.equal(validateHarnessWorkflowRun(persistedRun).valid, true);
  const serializedRun = JSON.stringify(persistedRun);
  assert.equal(serializedRun.includes(session.transcript[0].text), false);
  assert.equal(serializedRun.includes(productResult.report.summary), false);

  const result = {
    generatedAt: new Date().toISOString(),
    executionMode: 'local_observe',
    verdict: 'LOCAL_REPORT_OBSERVE_GATE_PASS',
    metrics: {
      criticalFixtureCount: criticalResults.length,
      criticalFalseNegativeCount,
      unsupportedClaimPublishableCount: representativeResults.filter((item) => (
        item.id === 'unsupported_high_confidence_claim'
        && ['ready', 'ready_after_repair', 'published'].includes(item.publicationStatus)
      )).length,
      productResultIdentityPreserved: wrapperResult === productResult,
      candidatePayloadLeakCount: Number(
        serializedRun.includes(session.transcript[0].text)
        || serializedRun.includes(productResult.report.summary)
        || serializedExplicitRepairRun.includes('private repair instruction')
        || serializedExplicitRepairRun.includes('private QA detail')
        || serializedExplicitRepairRun.includes('private repaired report payload'),
      ),
      qaOnlySilentRepairCount: qaOnlyRun.actionContracts[0].repairLineage.attemptCount,
      legacyInlineRepairObserved: legacyRepair.repairLineage.legacyInlineRepairObserved,
      explicitRepairActionCount: legacyRepair.repairLineage.explicitRepairActionCount,
      explicitRepairActionsComplete: legacyRepair.repairLineage.explicitRepairActionsComplete,
      explicitRepairLineageComplete: legacyRepair.repairLineage.explicitRepairLineageComplete,
      explicitRepairChildRunsComplete: legacyRepair.repairLineage.explicitChildRunsComplete,
    },
    criticalResults,
    representativeResults,
    runtimePromotion: {
      publicationEnforcementEnabled: false,
      candidateVisibilityChanged: false,
      currentControllerRemainsAuthority: true,
    },
    remainingGates: [
      'product_owner_publication_visibility_decision',
      'false_block_fixture_and_human_calibration',
      'production_observe',
      'enforcement_approval',
    ],
  };

  assert.equal(result.metrics.unsupportedClaimPublishableCount, 0);
  assert.equal(result.metrics.candidatePayloadLeakCount, 0);
  assert.equal(result.metrics.qaOnlySilentRepairCount, 0);
  assert.equal(result.metrics.explicitRepairActionsComplete, true);
  assert.equal(result.metrics.explicitRepairLineageComplete, true);

  await mkdir(evidenceRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(evidenceRoot, 'm4-report-publication.json'), `${JSON.stringify(result, null, 2)}\n`),
    writeFile(path.join(evidenceRoot, 'm4-report-publication.md'), `# M4 Report Publication Observe Gate\n\n- Generated: ${result.generatedAt}\n- Verdict: \`${result.verdict}\`\n- Critical fixtures: ${result.metrics.criticalFixtureCount}\n- Critical false negatives: ${result.metrics.criticalFalseNegativeCount}\n- Unsupported claims marked publishable: ${result.metrics.unsupportedClaimPublishableCount}\n- Product-result identity preserved: yes\n- Candidate payload leaks: ${result.metrics.candidatePayloadLeakCount}\n- QA-only silent repairs: ${result.metrics.qaOnlySilentRepairCount}\n- Explicit repair actions: ${result.metrics.explicitRepairActionCount}\n- Explicit repair lineage complete: ${result.metrics.explicitRepairLineageComplete ? 'yes' : 'no'}\n\n## Current boundary\n\nThe adapter records shared publication and repair-attempt \`GateResult\` values in observe mode only. Each existing generate-report repair attempt is represented by a refs-only \`REPAIR_REPORT_DRAFT\` ActionContract and timeline events, satisfying the approved explicit-action-or-child-run lineage rule without creating a fourth formal task. It does not copy repair prompts, QA payloads, or candidate report content, and it does not change candidate visibility, downloads, exports, or current controller authority. The controller still executes the bounded inline loop; \`explicitChildRunsComplete=false\` is therefore descriptive, not an open lineage gate.\n\n## Remaining gates\n\n${result.remainingGates.map((gate) => `- \`${gate}\``).join('\n')}\n`),
  ]);

  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
