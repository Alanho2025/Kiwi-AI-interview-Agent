import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildInterviewNextTurnWorkflowRun,
  validateHarnessWorkflowRun,
} from '../../src/services/harness/harnessWorkflowRunContract.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceRoot = path.resolve(backendRoot, '../docs/harness/evidence');

const session = {
  id: 'm2-observe-session-001',
  userId: 'm2-observe-user-001',
  status: 'in_progress',
  mode: 'text',
  currentQuestionIndex: 2,
  totalQuestions: 8,
  targetRole: 'Backend Engineer',
  cvFileId: 'm2-cv-001',
  jdFingerprint: 'm2-jd-001',
  transcript: [
    { role: 'ai', questionId: 'm2-question-002', metadata: { countsAsQuestion: true } },
    { role: 'user', metadata: { inputMode: 'text' } },
  ],
  interviewPlan: {
    schemaVersion: 'interview-plan-v2',
    strategy: { matchAnalysisId: 'm2-match-001' },
  },
};

const result = {
  nextQuestionOrder: 3,
  isComplete: false,
  controllerAction: 'ASK_DEEP_DIVE_QUESTION',
  fallbackAction: 'ASK_DEEP_DIVE_QUESTION',
  selectionSource: 'model_assisted',
};

const buildObservation = ({
  modelSelectionError = null,
  rejectedCandidates = [],
  selectedWasDuplicate = false,
  turnKind = 'follow_up',
  questionType = 'follow_up',
  reflection = false,
} = {}) => ({
  decisionContext: { currentStage: 'technical_core', currentTopic: 'delivery' },
  fallbackPlan: { selectedAction: 'ASK_DEEP_DIVE_QUESTION' },
  plan: {
    selectedAction: 'ASK_DEEP_DIVE_QUESTION',
    fallbackAction: 'ASK_DEEP_DIVE_QUESTION',
    selectionSource: modelSelectionError ? 'rule_fallback' : 'model_assisted',
    modelSelectionError,
    candidateActions: [
      { action: 'ASK_DEEP_DIVE_QUESTION', score: 0.8 },
      { action: 'SWITCH_TOPIC', score: 0.4 },
    ],
  },
  interviewerOutput: {
    turnKind,
    questionType,
    questionDecision: {
      selectedQuestionId: 'm2-question-003',
      rejectedCandidates,
      deduplication: { selectedWasDuplicate },
    },
  },
  reflectionRecord: reflection ? { reflectionId: 'm2-reflection-001' } : null,
});

const buildRun = ({ workflowRunId, observation, runResult = result, lifecycleStatus } = {}) => (
  buildInterviewNextTurnWorkflowRun({
    workflowRunId,
    executionMode: 'observe',
    session,
    payload: { inputMode: 'text', clientTurnId: `turn:${workflowRunId}` },
    observation,
    result: runResult,
    lifecycleStatus,
    startedAt: '2026-07-15T12:00:00.000Z',
    completedAt: '2026-07-15T12:00:01.000Z',
  })
);

const findGate = (run, gateType) => run.gateResults.find((gate) => gate.gateType === gateType);

const main = async () => {
  const scenarios = [];
  const record = (id, assertion) => {
    assertion();
    scenarios.push({ id, passed: true });
  };

  const happy = buildRun({
    workflowRunId: 'm2-run-happy',
    observation: buildObservation({ reflection: true }),
  });
  record('shared_contracts_validate_in_observe_mode', () => {
    assert.deepEqual(validateHarnessWorkflowRun(happy), { valid: true, errors: [] });
    assert.equal(happy.executionMode, 'observe');
    assert.equal(happy.gateResults.every((gate) => gate.executionMode === 'observe'), true);
  });
  record('memory_writes_preserve_scoring_isolation', () => {
    assert.equal(happy.memoryWrites.length, 3);
    assert.equal(happy.memoryWrites.every((write) => write.canAffectScoring === false), true);
    assert.equal(happy.memoryWrites.every((write) => write.policy?.canAffectScoring === false), true);
  });

  const fallback = buildRun({
    workflowRunId: 'm2-run-fallback',
    observation: buildObservation({ modelSelectionError: 'disallowed action' }),
    runResult: { ...result, selectionSource: 'rule_fallback' },
  });
  record('model_failure_uses_bounded_fallback_lineage', () => {
    assert.equal(fallback.failures[0]?.category, 'model_output_failure');
    assert.equal(fallback.failures[0]?.fallbackApplied, true);
    assert.equal(fallback.failures[0]?.handled, true);
  });

  const duplicateRejected = buildRun({
    workflowRunId: 'm2-run-duplicate-rejected',
    observation: buildObservation({
      rejectedCandidates: [{ questionId: 'duplicate', reason: 'duplicate_fingerprint' }],
    }),
  });
  record('correctly_rejected_duplicate_is_not_a_violation', () => {
    assert.equal(findGate(duplicateRejected, 'question_novelty')?.status, 'pass');
    assert.deepEqual(findGate(duplicateRejected, 'question_novelty')?.reasonCodes, ['duplicate_candidates_rejected']);
  });

  const duplicateSelected = buildRun({
    workflowRunId: 'm2-run-duplicate-selected',
    observation: buildObservation({ selectedWasDuplicate: true }),
  });
  record('selected_duplicate_is_observed_without_blocking', () => {
    const gate = findGate(duplicateSelected, 'question_novelty');
    assert.equal(gate?.status, 'warn');
    assert.equal(gate?.blockingScope, 'action');
    assert.equal(gate?.enforced, false);
  });

  const repairMiscount = buildRun({
    workflowRunId: 'm2-run-repair-miscount',
    observation: buildObservation({ turnKind: 'repair', questionType: 'clarification' }),
  });
  record('repair_counting_violation_is_classified', () => {
    const gate = findGate(repairMiscount, 'question_counting');
    assert.equal(gate?.status, 'warn');
    assert.deepEqual(gate?.reasonCodes, ['non_interview_turn_advanced_question_count']);
  });

  const voiceWaiting = buildInterviewNextTurnWorkflowRun({
    workflowRunId: 'm2-run-voice-waiting',
    executionMode: 'observe',
    session: { ...session, mode: 'voice' },
    payload: { inputMode: 'duplex_voice', clientTurnId: 'm2-voice-turn' },
    lifecycleStatus: 'waiting',
    startedAt: '2026-07-15T12:01:00.000Z',
    completedAt: '2026-07-15T12:01:00.000Z',
  });
  record('voice_confirmation_waits_and_blocks_scoring_only', () => {
    const gate = findGate(voiceWaiting, 'transcript_eligibility');
    assert.equal(gate?.status, 'review');
    assert.equal(gate?.blockingScope, 'scoring');
    assert.equal(gate?.nextStep?.type, 'wait_for_review');
  });

  const redacted = JSON.stringify(happy);
  record('observed_contracts_do_not_copy_candidate_payload', () => {
    assert.equal(redacted.includes('candidate answer'), false);
    assert.equal(redacted.includes('generated question wording'), false);
  });

  const resultArtifact = {
    generatedAt: new Date().toISOString(),
    executionMode: 'observe',
    verdict: 'LOCAL_OBSERVE_CONTRACTS_PASS',
    scenarioCount: scenarios.length,
    passedScenarioCount: scenarios.length,
    scenarios,
    promotion: {
      warnEnabled: false,
      enforceEnabled: false,
      productionEnabled: false,
    },
    remainingGates: ['human_h1', 'production_observe', 'warn_approval', 'enforce_approval'],
  };

  await mkdir(evidenceRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(evidenceRoot, 'm2-observed-contracts.json'), `${JSON.stringify(resultArtifact, null, 2)}\n`),
    writeFile(path.join(evidenceRoot, 'm2-observed-contracts.md'), `# M2 Observed Contracts\n\n- Generated: ${resultArtifact.generatedAt}\n- Mode: \`observe\`\n- Verdict: \`${resultArtifact.verdict}\`\n- Scenarios: ${resultArtifact.passedScenarioCount}/${resultArtifact.scenarioCount} passed\n\n| Scenario | Result |\n| --- | --- |\n${scenarios.map((scenario) => `| \`${scenario.id}\` | PASS |`).join('\n')}\n\n## Boundary\n\nThis is a deterministic local observe-mode replay. It does not enable warn, enforce, candidate-visible diagnostics, or production rollout. Existing controllers remain authoritative.\n`),
  ]);

  console.log(JSON.stringify(resultArtifact, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
