import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRoot = path.resolve(backendRoot, '..');
const evidenceRoot = path.join(repoRoot, 'docs/harness/evidence');

const readJson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'));

const main = async () => {
  const [m1, m2, m3, m4, browser, voiceRobustness] = await Promise.all([
    readJson(path.join(evidenceRoot, 'm1-replay-result.json')),
    readJson(path.join(evidenceRoot, 'm2-observed-contracts.json')),
    readJson(path.join(evidenceRoot, 'm3-memory-outcomes.json')),
    readJson(path.join(evidenceRoot, 'm4-report-publication.json')),
    readJson(path.join(repoRoot, 'output/playwright/harness-h1-voice-on.latest.json')),
    readJson(path.join(backendRoot, 'eval/reports/voice-robustness.latest.json')),
  ]);

  const interviewRuns = browser.harnessRuns.filter((run) => run.taskType === 'interview_next_turn');
  const reportRuns = browser.harnessRuns.filter((run) => run.taskType === 'generate_report');
  const uniqueInterviewRunIds = new Set(interviewRuns.map((run) => run.workflowRunId));
  const allMemoryWrites = interviewRuns.flatMap((run) => run.memoryWrites || []);
  const latencyValues = browser.perTurnNextQuestionFirstAudioMs.filter(Number.isFinite);
  const latencySloPassCount = latencyValues.filter((value) => value <= 3000).length;
  const latencySloFailureCount = latencyValues.length - latencySloPassCount;
  const sameRunConfirmationPassed = m1.scenarios.some((item) => item.id === 'voice_confirmation_same_run' && item.passed)
    && m2.scenarios.some((item) => item.id === 'voice_confirmation_waits_and_blocks_scoring_only' && item.passed);

  assert.equal(browser.passed, true);
  assert.equal(browser.completedTurnCount, 2);
  assert.equal(interviewRuns.length, 2);
  assert.equal(uniqueInterviewRunIds.size, 2);
  assert.equal(interviewRuns.every((run) => run.lifecycleStatus === 'completed' && run.qualityStatus === 'valid'), true);
  assert.equal(allMemoryWrites.every((write) => write.status === 'completed' && write.canAffectScoring === false), true);
  assert.equal(reportRuns.some((run) => run.publicationGate === 'block' && run.publicationStatus === 'needs_review'), true);
  assert.equal(browser.candidateInternalTraceExposed, false);
  assert.equal(voiceRobustness.casesRun, 8);
  assert.equal(voiceRobustness.average, 1);
  assert.equal(sameRunConfirmationPassed, true);
  assert.equal(m3.metrics.evaluatorOutputChangedByMemory, false);
  assert.equal(m4.metrics.criticalFalseNegativeCount, 0);
  assert.equal(m4.metrics.explicitRepairLineageComplete, true);

  const requiredGateFailures = [
    ...(latencySloFailureCount > 0 ? ['synthetic_browser_voice_latency_slo'] : []),
    'human_microphone_validation',
    'live_speech_provider_validation',
    'production_observe_validation',
    'report_publication_enforcement_approval',
    'memory_product_policy_and_user_controls',
  ];
  const result = {
    generatedAt: new Date().toISOString(),
    verdict: 'LOCAL_FUNCTIONAL_PASS_RELEASE_NOT_READY',
    releaseReady: false,
    evidenceMode: 'local_mock_ai_test_stt_tts_plus_browser',
    metrics: {
      voiceRobustnessCases: voiceRobustness.casesRun,
      voiceRobustnessAverage: voiceRobustness.average,
      browserCompletedTurns: browser.completedTurnCount,
      canonicalInterviewRunCount: interviewRuns.length,
      duplicateCanonicalInterviewRunCount: interviewRuns.length - uniqueInterviewRunIds.size,
      completedMemoryWriteCount: allMemoryWrites.length,
      unsafeMemoryWriteCount: allMemoryWrites.filter((write) => write.status !== 'completed' || write.canAffectScoring !== false).length,
      reportPublicationBlockObserved: reportRuns.some((run) => run.publicationGate === 'block'),
      reportRepairLineageComplete: m4.metrics.explicitRepairLineageComplete,
      candidateInternalTraceExposed: browser.candidateInternalTraceExposed,
      sameRunConfirmationPassed,
      perTurnNextQuestionFirstAudioMs: latencyValues,
      latencySloPassCount,
      latencySloFailureCount,
      maximumFirstAudioMs: latencyValues.length ? Math.max(...latencyValues) : null,
      latencySloMs: 3000,
    },
    milestoneEvidence: {
      m1: m1.verdict,
      m2: m2.verdict,
      m3: m3.verdict,
      m4: m4.verdict,
    },
    runtimeCoverage: {
      formalObservedTasks: ['interview_next_turn', 'generate_report', 'qa_report'],
      docsOrShadowMappingOnly: ['cv_jd_match', 'prepare_question_pool'],
      channels: ['text', 'voice'],
    },
    requiredGateFailures,
    releaseBoundary: {
      warnOrEnforceEnabled: false,
      userMemoryPlanningEnabledByDefault: false,
      reportPublicationEnforcementEnabled: false,
      candidateVisibilityChanged: false,
      liveProviderEvidenceAvailable: false,
      productionEvidenceAvailable: false,
    },
  };

  assert.equal(result.metrics.duplicateCanonicalInterviewRunCount, 0);
  assert.equal(result.metrics.unsafeMemoryWriteCount, 0);
  assert.equal(result.releaseReady, false);

  await mkdir(evidenceRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(evidenceRoot, 'm5-voice-regression.json'), `${JSON.stringify(result, null, 2)}\n`),
    writeFile(path.join(evidenceRoot, 'm5-voice-regression.md'), `# M5 Voice and Cross-Product Release Evidence\n\n- Generated: ${result.generatedAt}\n- Verdict: \`${result.verdict}\`\n- Release ready: no\n- Evidence mode: local browser with mock AI and test STT/TTS\n\n## Local functional evidence\n\n| Outcome | Result |\n| --- | --- |\n| Voice robustness | ${result.metrics.voiceRobustnessCases}/8 cases, average ${result.metrics.voiceRobustnessAverage.toFixed(2)} |\n| Browser voice turns | ${result.metrics.browserCompletedTurns}/2 completed |\n| Canonical interview runs | ${result.metrics.canonicalInterviewRunCount}; duplicates ${result.metrics.duplicateCanonicalInterviewRunCount} |\n| Memory writes | ${result.metrics.completedMemoryWriteCount} completed; unsafe ${result.metrics.unsafeMemoryWriteCount} |\n| Same-run confirmation | ${result.metrics.sameRunConfirmationPassed ? 'PASS' : 'FAIL'} |\n| Report publication block observed | ${result.metrics.reportPublicationBlockObserved ? 'PASS' : 'FAIL'} |\n| Report repair lineage | ${result.metrics.reportRepairLineageComplete ? 'PASS' : 'FAIL'} |\n| Candidate internal trace exposed | ${result.metrics.candidateInternalTraceExposed ? 'FAIL' : 'PASS'} |\n\n## Latency gate\n\nPer-turn speech-end to first-audio values were ${result.metrics.perTurnNextQuestionFirstAudioMs.map((value) => `${value} ms`).join(', ')}. ${result.metrics.latencySloPassCount}/${result.metrics.perTurnNextQuestionFirstAudioMs.length} met the <= ${result.metrics.latencySloMs} ms product SLO; the maximum was ${result.metrics.maximumFirstAudioMs} ms. Therefore the latency gate is not verified.\n\n## Runtime coverage\n\nFormal observed tasks: \`interview_next_turn\`, \`generate_report\`, \`qa_report\`. CV-JD matching and question-pool preparation remain docs/shadow mapping only; this release evidence does not claim runtime harness coverage for them.\n\n## Required open gates\n\n${result.requiredGateFailures.map((gate) => `- \`${gate}\``).join('\n')}\n`),
  ]);

  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
