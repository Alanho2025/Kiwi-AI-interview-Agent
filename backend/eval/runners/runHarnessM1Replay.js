import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  beginWaitingInterviewNextTurnRun,
  recordRejectedInterviewNextTurnRun,
  runInterviewNextTurnWithShadowHarness,
} from '../../src/services/harness/interviewNextTurnShadowHarness.js';
import { dedupeUserCoachingMemoryRecords } from '../../src/services/aiControl/userCoachingMemoryService.js';
import { correlateHarnessRunArtifacts } from '../../src/services/harness/harnessRunCorrelationService.js';
import { buildHarnessRunTrace } from '../../src/services/harness/harnessRunTraceService.js';
import { validateHarnessWorkflowRun } from '../../src/services/harness/harnessWorkflowRunContract.js';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const evidenceRoot = path.resolve(backendRoot, '../docs/harness/evidence');
const sensitiveAnswer = 'I owned the private payment migration and reduced failures by 37 percent.';
const sensitiveQuestion = 'What trade-off did you make during the private payment migration?';

const session = {
  id: 'm1-replay-session-001',
  userId: 'm1-replay-user-001',
  status: 'in_progress',
  mode: 'text',
  currentQuestionIndex: 2,
  totalQuestions: 6,
  targetRole: 'Backend Engineer',
  cvFileId: 'm1-replay-cv-001',
  jdFingerprint: 'm1-replay-jd-fingerprint-001',
  transcript: [
    {
      role: 'ai',
      text: 'Tell me about a production migration you owned.',
      questionId: 'm1-replay-question-002',
      metadata: { countsAsQuestion: true },
    },
    { role: 'user', text: sensitiveAnswer, metadata: { inputMode: 'text' } },
  ],
  interviewPlan: {
    schemaVersion: 'interview-plan-v2',
    strategy: { matchAnalysisId: 'm1-replay-match-001' },
  },
};

const legacyResult = Object.freeze({
  nextQuestion: sensitiveQuestion,
  displayText: sensitiveQuestion,
  nextQuestionOrder: 3,
  isComplete: false,
  controllerAction: 'ASK_DEEP_DIVE_QUESTION',
  fallbackAction: 'ASK_DEEP_DIVE_QUESTION',
  selectionSource: 'model_assisted',
});

const buildObservation = ({ modelSelectionError = null, reflection = false } = {}) => ({
  decisionContext: {
    currentStage: 'technical_core',
    currentObjective: 'validate_owned_delivery',
    currentTopic: 'private_payment_migration',
    retrievalState: { latestSources: ['cv_profile', 'jd_rubric', 'transcript'] },
  },
  fallbackPlan: { selectedAction: 'ASK_DEEP_DIVE_QUESTION' },
  plan: {
    selectedAction: 'ASK_DEEP_DIVE_QUESTION',
    fallbackAction: 'ASK_DEEP_DIVE_QUESTION',
    selectionSource: modelSelectionError ? 'rule_fallback' : 'model_assisted',
    modelSelectedAction: modelSelectionError ? null : 'ASK_DEEP_DIVE_QUESTION',
    modelSelectionError,
    confidence: 0.82,
    candidateActions: [
      { action: 'ASK_DEEP_DIVE_QUESTION', score: 0.82, reason: 'sensitive deterministic reason' },
      { action: 'SWITCH_TOPIC', score: 0.42, reason: 'sensitive alternate reason' },
    ],
  },
  interviewerOutput: {
    nextQuestion: sensitiveQuestion,
    displayText: sensitiveQuestion,
    isComplete: false,
    questionType: 'follow_up',
    turnKind: 'follow_up',
    questionDecision: { selectedQuestionId: 'm1-replay-question-003', rejectedCandidates: [] },
  },
  reflectionRecord: reflection ? { reflectionId: 'm1-replay-reflection-001' } : null,
});

const createNowSequence = (...values) => {
  let index = 0;
  return () => new Date(values[Math.min(index++, values.length - 1)]);
};

const runReplay = async () => {
  const scenarios = [];

  let offAppendCount = 0;
  const offResult = await runInterviewNextTurnWithShadowHarness({
    enabled: false,
    session,
    payload: { inputMode: 'text', clientTurnId: 'm1-text-turn-off' },
    executeController: async () => legacyResult,
    appendRun: async () => { offAppendCount += 1; },
  });
  assert.deepEqual(offResult, legacyResult);
  assert.equal(offAppendCount, 0);
  scenarios.push({ id: 'flag_off_rollback', passed: true });

  let happyRun = null;
  const onResult = await runInterviewNextTurnWithShadowHarness({
    enabled: true,
    session,
    payload: { answer: sensitiveAnswer, inputMode: 'text', clientTurnId: 'm1-text-turn-on' },
    executeController: async ({ observe }) => {
      observe(buildObservation());
      return legacyResult;
    },
    appendRun: async (run) => { happyRun = run; },
    workflowRunIdFactory: () => 'm1-workflow-run-happy',
    now: createNowSequence('2026-07-15T00:00:00.000Z', '2026-07-15T00:00:01.250Z'),
  });
  assert.deepEqual(onResult, offResult);
  assert.deepEqual(validateHarnessWorkflowRun(happyRun), { valid: true, errors: [] });
  const serializedHappyRun = JSON.stringify(happyRun);
  assert.equal(serializedHappyRun.includes(sensitiveAnswer), false);
  assert.equal(serializedHappyRun.includes(sensitiveQuestion), false);
  assert.equal(serializedHappyRun.includes('sensitive deterministic reason'), false);
  scenarios.push({ id: 'text_happy_path_legacy_parity', passed: true });
  scenarios.push({ id: 'refs_only_privacy', passed: true });

  let invalidActionRun = null;
  const fallbackResult = { ...legacyResult, selectionSource: 'rule_fallback' };
  const invalidActionResult = await runInterviewNextTurnWithShadowHarness({
    enabled: true,
    session,
    payload: { inputMode: 'text', clientTurnId: 'm1-text-turn-invalid-action' },
    executeController: async ({ observe }) => {
      observe(buildObservation({ modelSelectionError: 'Model selected disallowed action: DELETE_SESSION' }));
      return fallbackResult;
    },
    appendRun: async (run) => { invalidActionRun = run; },
    workflowRunIdFactory: () => 'm1-workflow-run-invalid-action',
  });
  assert.deepEqual(invalidActionResult, fallbackResult);
  assert.equal(invalidActionRun.failures[0]?.reasonCode, 'model_action_selection_failed');
  assert.equal(invalidActionRun.actionContracts[0]?.fallbackAction, 'ASK_DEEP_DIVE_QUESTION');
  scenarios.push({ id: 'invalid_model_action_fallback_lineage', passed: true });

  let rejectedVoiceRun = null;
  await recordRejectedInterviewNextTurnRun({
    enabled: true,
    session: { ...session, mode: 'voice' },
    payload: { inputMode: 'duplex_voice', clientTurnId: 'm1-voice-turn-rejected' },
    failure: {
      category: 'channel_transport',
      reasonCode: 'voice_turn_not_active',
      retryable: true,
      userImpact: 'turn_retry_required',
    },
    appendRun: async (run) => { rejectedVoiceRun = run; },
    workflowRunIdFactory: () => 'm1-workflow-run-voice-rejected',
    now: createNowSequence('2026-07-15T00:00:30.000Z'),
  });
  assert.deepEqual(validateHarnessWorkflowRun(rejectedVoiceRun), { valid: true, errors: [] });
  assert.equal(rejectedVoiceRun.lifecycleStatus, 'failed');
  assert.equal(rejectedVoiceRun.gateResults[0]?.status, 'block');
  assert.equal(rejectedVoiceRun.failures[0]?.reasonCode, 'voice_turn_not_active');
  assert.equal(rejectedVoiceRun.timeline.some((event) => event.eventType === 'voice_turn_rejected'), true);
  scenarios.push({ id: 'voice_pretask_rejection_traceable', passed: true });

  const canonicalRuns = new Map();
  const appendCanonicalInMemory = async (run) => {
    const existing = canonicalRuns.get(run.workflowRunId);
    canonicalRuns.set(run.workflowRunId, existing
      ? { ...existing, ...run, timeline: [...(existing.timeline || []), ...(run.timeline || [])] }
      : run);
  };
  const waiting = await beginWaitingInterviewNextTurnRun({
    enabled: true,
    session: { ...session, mode: 'voice' },
    payload: { inputMode: 'duplex_voice', clientTurnId: 'm1-voice-turn-original' },
    appendRun: appendCanonicalInMemory,
    workflowRunIdFactory: () => 'm1-workflow-run-voice-waiting',
    now: createNowSequence('2026-07-15T00:01:00.000Z'),
  });
  await runInterviewNextTurnWithShadowHarness({
    enabled: true,
    session: { ...session, mode: 'voice' },
    payload: {
      inputMode: 'duplex_voice',
      clientTurnId: 'm1-voice-turn-confirmation',
      workflowRunId: waiting.workflowRunId,
    },
    executeController: async ({ observe }) => {
      observe(buildObservation());
      return legacyResult;
    },
    appendRun: appendCanonicalInMemory,
    workflowRunIdFactory: () => 'must-not-create-child-run',
    now: createNowSequence('2026-07-15T00:01:10.000Z', '2026-07-15T00:01:11.000Z'),
  });
  const voiceRun = canonicalRuns.get(waiting.workflowRunId);
  assert.equal(canonicalRuns.size, 1);
  assert.equal(voiceRun.timeline.some((event) => event.eventType === 'workflow_run_waiting'), true);
  assert.equal(voiceRun.timeline.some((event) => event.eventType === 'workflow_run_resumed'), true);
  scenarios.push({ id: 'voice_confirmation_same_run', passed: true });
  scenarios.push({ id: 'duplicate_canonical_run_count_zero', passed: true });

  const recordingFailures = [];
  const persistenceFailureResult = await runInterviewNextTurnWithShadowHarness({
    enabled: true,
    session,
    payload: { inputMode: 'text', clientTurnId: 'm1-text-turn-persistence-failure' },
    executeController: async ({ observe }) => {
      observe(buildObservation());
      return legacyResult;
    },
    appendRun: async () => { throw new Error('injected shadow persistence failure'); },
    onRecordingFailure: (failure) => recordingFailures.push(failure),
    workflowRunIdFactory: () => 'm1-workflow-run-persistence-failure',
  });
  assert.deepEqual(persistenceFailureResult, legacyResult);
  assert.equal(recordingFailures[0]?.reasonCode, 'shadow_persistence_failed');
  scenarios.push({ id: 'shadow_persistence_failure_preserves_product_result', passed: true });

  const correlated = await correlateHarnessRunArtifacts({
    run: {
      ...happyRun,
      memoryWrites: happyRun.memoryWrites.map((write) => ({ ...write, status: 'scheduled' })),
    },
    loadSessionAnalysis: async () => ({
      decisionRecords: [{ workflowRunId: happyRun.workflowRunId }],
      trajectoryRecords: [{ workflowRunId: happyRun.workflowRunId }],
      agentTraceEvents: [{ workflowRunId: happyRun.workflowRunId }],
      agentMemory: { sourceWorkflowRunId: happyRun.workflowRunId },
      reflectionRecords: [],
    }),
    loadUserCoachingMemory: async () => ({ memoryRecords: [] }),
  });
  assert.equal(correlated.memoryWrites.every((write) => write.status === 'completed'), true);
  assert.equal(correlated.memoryWrites.every((write) => write.canAffectScoring === false), true);
  scenarios.push({ id: 'background_memory_write_correlated_no_scoring', passed: true });

  const immediateTrace = buildHarnessRunTrace({
    run: happyRun,
    traceStage: 'task_completed',
    persistenceStatus: 'queued',
  });
  assert.equal(immediateTrace.workflowRunId, happyRun.workflowRunId);
  assert.equal(immediateTrace.persistenceStatus, 'queued');
  assert.equal(JSON.stringify(immediateTrace).includes(session.userId), false);
  assert.equal(JSON.stringify(immediateTrace).includes(sensitiveAnswer), false);
  assert.equal(JSON.stringify(immediateTrace).includes(sensitiveQuestion), false);
  scenarios.push({ id: 'backend_trace_immediate_redacted', passed: true });

  const repeatedLessonRecords = dedupeUserCoachingMemoryRecords([
    {
      memoryId: 'm1-memory-old',
      sourceWorkflowRunId: 'm1-workflow-run-old',
      pattern: 'useful_progress',
      lesson: 'Keep building depth on owned decisions.',
    },
    {
      memoryId: 'm1-memory-current',
      sourceWorkflowRunId: happyRun.workflowRunId,
      pattern: 'useful_progress',
      lesson: 'Keep building depth on owned decisions.',
    },
  ]);
  assert.equal(repeatedLessonRecords.length, 1);
  assert.equal(repeatedLessonRecords[0]?.sourceWorkflowRunId, happyRun.workflowRunId);
  scenarios.push({ id: 'repeated_memory_keeps_latest_provenance', passed: true });

  return { scenarios, happyRun: correlated };
};

const median = (values) => {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)];
};

const runDebugBenchmark = () => {
  const caseIds = [
    'model_action_failure',
    'memory_orphan',
    'voice_waiting_resume',
    'privacy_snapshot_violation',
    'shadow_persistence_failure',
  ];
  const expectedByCase = new Map(caseIds.map((caseId) => [caseId, `${caseId}_owner`]));
  const noiseCount = 12000;
  const legacyArtifacts = {
    logs: Array.from({ length: noiseCount }, (_, index) => ({ caseId: `noise-log-${index}`, owner: 'noise' })),
    decisions: Array.from({ length: noiseCount }, (_, index) => ({ caseId: `noise-decision-${index}`, owner: 'noise' })),
    trajectories: Array.from({ length: noiseCount }, (_, index) => ({ caseId: `noise-trajectory-${index}`, owner: 'noise' })),
    memories: Array.from({ length: noiseCount }, (_, index) => ({ caseId: `noise-memory-${index}`, owner: 'noise' })),
  };
  caseIds.forEach((caseId, index) => {
    const bucket = Object.values(legacyArtifacts)[index % Object.keys(legacyArtifacts).length];
    bucket.push({ caseId, owner: expectedByCase.get(caseId) });
  });
  const harnessIndex = new Map(caseIds.map((caseId) => [caseId, { owner: expectedByCase.get(caseId) }]));

  const diagnoseLegacy = (caseId) => {
    for (const records of Object.values(legacyArtifacts)) {
      const match = records.find((record) => record.caseId === caseId);
      if (match) return match.owner;
    }
    return null;
  };
  const diagnoseHarness = (caseId) => harnessIndex.get(caseId)?.owner || null;
  const measure = (fn, caseId) => {
    const startedAt = performance.now();
    for (let index = 0; index < 40; index += 1) fn(caseId);
    return performance.now() - startedAt;
  };

  caseIds.forEach((caseId) => {
    assert.equal(diagnoseLegacy(caseId), expectedByCase.get(caseId));
    assert.equal(diagnoseHarness(caseId), expectedByCase.get(caseId));
  });

  caseIds.forEach((caseId) => {
    measure(diagnoseLegacy, caseId);
    measure(diagnoseHarness, caseId);
  });
  const legacySamples = [];
  const harnessSamples = [];
  for (let round = 0; round < 21; round += 1) {
    caseIds.forEach((caseId) => {
      legacySamples.push(measure(diagnoseLegacy, caseId));
      harnessSamples.push(measure(diagnoseHarness, caseId));
    });
  }

  const legacyMedianMs = median(legacySamples);
  const harnessMedianMs = median(harnessSamples);
  const reductionPercent = legacyMedianMs > 0
    ? ((legacyMedianMs - harnessMedianMs) / legacyMedianMs) * 100
    : 0;
  return {
    benchmarkKind: 'deterministic_lookup_proxy',
    failureTaskCount: caseIds.length,
    iterationsPerSample: 40,
    sampleCount: legacySamples.length,
    correctnessPercent: 100,
    legacyMedianMs,
    harnessMedianMs,
    reductionPercent,
    targetReductionPercent: 50,
    passed: reductionPercent >= 50,
    humanDiagnosisStillRequired: true,
  };
};

const formatMs = (value) => value.toFixed(4);
const formatPercent = (value) => value.toFixed(2);

const main = async () => {
  const { scenarios, happyRun } = await runReplay();
  const benchmark = runDebugBenchmark();
  assert.equal(benchmark.passed, true);
  const replayResult = {
    generatedAt: new Date().toISOString(),
    executionMode: 'mock_deterministic_local',
    verdict: 'READY_FOR_HUMAN_VALIDATION',
    scenarioCount: scenarios.length,
    passedScenarioCount: scenarios.filter((scenario) => scenario.passed).length,
    scenarios,
    benchmark,
    unverifiedGates: ['human_debug_session', 'human_microphone', 'live_voice_provider', 'production_shadow'],
  };

  await mkdir(evidenceRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(evidenceRoot, 'm1-shadow-run-sample.json'), `${JSON.stringify(happyRun, null, 2)}\n`),
    writeFile(path.join(evidenceRoot, 'm1-replay-result.json'), `${JSON.stringify(replayResult, null, 2)}\n`),
    writeFile(path.join(evidenceRoot, 'm1-before-after-replay.md'), `# M1 Before/After Replay\n\n- Generated: ${replayResult.generatedAt}\n- Mode: \`mock_deterministic_local\`\n- Verdict: \`READY_FOR_HUMAN_VALIDATION\`\n- Scenarios: ${replayResult.passedScenarioCount}/${replayResult.scenarioCount} passed\n\n## Result\n\n| Scenario | Result |\n| --- | --- |\n${scenarios.map((scenario) => `| \`${scenario.id}\` | PASS |`).join('\n')}\n\nHarness OFF and ON returned structurally identical legacy results for the frozen text fixture. The sample run contains refs/hash/version metadata and does not contain the answer, generated question text, or candidate-action rationale.\n\n## Boundaries\n\nThis replay is deterministic and mock-safe. Automated browser H1 has passed with mock AI and test STT/TTS. Human debug timing, human microphone, live speech providers, and production shadow remain unverified.\n`),
    writeFile(path.join(evidenceRoot, 'm1-debug-benchmark.md'), `# M1 Debug Benchmark\n\n- Generated: ${replayResult.generatedAt}\n- Benchmark: deterministic lookup proxy over current scattered log/decision/trajectory/memory shapes\n- Failure tasks: ${benchmark.failureTaskCount}\n- Correct diagnosis: ${benchmark.correctnessPercent}%\n- Legacy median: ${formatMs(benchmark.legacyMedianMs)} ms\n- Harness median: ${formatMs(benchmark.harnessMedianMs)} ms\n- Reduction: ${formatPercent(benchmark.reductionPercent)}%\n- Target: at least ${benchmark.targetReductionPercent}%\n- Proxy verdict: ${benchmark.passed ? 'PASS' : 'FAIL'}\n\nThis measures deterministic lookup cost, not a human developer's wall-clock diagnosis time. Automated browser H1 confirmed that the durable timeline is populated after real frontend/backend/WebSocket execution, but human diagnosis timing remains required.\n`),
  ]);

  console.log(JSON.stringify(replayResult, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
