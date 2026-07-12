import fs from 'node:fs/promises';
import path from 'node:path';

const ARTIFACT_CONTRACTS = Object.freeze({
  reviewLock: {
    label: 'Review lock bypass',
    filename: 'review-lock-bypass.latest.json',
    blocker: 'review_lock_bypass_allowed_usable_match',
    requiredAssertions: ['review_lock_bypass_blocked'],
  },
  voiceLowConfidence: {
    label: 'Voice low-confidence UI',
    filename: 'voice-low-confidence-ui.latest.json',
    blocker: 'low_confidence_incremented_question_count',
    requiredAssertions: ['low_confidence_confirmation_visible', 'question_count_unchanged'],
  },
  retentionDeletion: {
    label: 'Retention deletion lifecycle',
    filename: 'retention-deletion-lifecycle.latest.json',
    blocker: 'retention_deleted_artifact_readable',
    requiredAssertions: ['deleted_session_not_readable', 'deleted_cv_not_reusable'],
  },
  voiceNetworkBargeIn: {
    label: 'Voice network and barge-in',
    filename: 'voice-network-barge-in.latest.json',
    blocker: 'voice_flow_failed',
    requiredAssertions: ['bounded_slow_network_completed', 'barge_in_acknowledged'],
  },
});

const EXTERNAL_BOUNDARIES = Object.freeze([
  'live_azure_stt_not_run',
  'live_elevenlabs_tts_not_run',
  'production_retention_telemetry_unavailable',
  'real_provider_semantic_judge_not_run',
]);

const readJsonFile = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const readOptionalJsonFile = async (filePath) => {
  try {
    return await readJsonFile(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

const toArray = (value) => (Array.isArray(value) ? value : []);

const hasRequiredAssertions = (artifact = null, requiredAssertions = []) => {
  const assertions = new Set(toArray(artifact?.assertions));
  return requiredAssertions.every((assertion) => assertions.has(assertion));
};

const buildGate = ({ artifact, contract, key }) => {
  if (!artifact) {
    return {
      status: 'missing',
      blocker: `missing_required_artifact:${key}`,
      assertionCount: 0,
      browserErrorCount: 0,
      knownIssues: [],
    };
  }

  const browserErrorCount = toArray(artifact.browserErrors).length;
  const artifactBlockers = toArray(artifact.blockers);
  const requiredAssertionsPresent = hasRequiredAssertions(artifact, contract.requiredAssertions);
  const passed = artifact.passed === true
    && artifactBlockers.length === 0
    && browserErrorCount === 0
    && requiredAssertionsPresent;

  const blockers = [
    ...artifactBlockers,
    ...(artifact.passed === true ? [] : [contract.blocker]),
    ...(requiredAssertionsPresent ? [] : [`missing_required_assertion:${key}`]),
    ...(browserErrorCount ? [`browser_errors_present:${key}`] : []),
  ];

  return {
    status: passed ? 'passed' : 'failed',
    blocker: blockers[0] || null,
    blockers,
    schemaVersion: artifact.schemaVersion || null,
    truthLevel: artifact.truthLevel || null,
    resultType: artifact.resultType || null,
    assertionCount: toArray(artifact.assertions).length,
    requiredAssertionsPresent,
    browserErrorCount,
    knownIssues: toArray(artifact.knownIssues),
  };
};

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const collectGateBlockers = (gates = {}) => Object.entries(gates).flatMap(([key, gate]) => {
  if (gate.status === 'passed') return [];
  if (gate.status === 'missing') return [`missing_required_artifact:${key}`];
  return toArray(gate.blockers).length ? gate.blockers : [gate.blocker].filter(Boolean);
});

const collectKnownIssues = ({ artifacts = {}, gates = {} }) => {
  const artifactKnownIssues = Object.values(artifacts).flatMap((artifact) => toArray(artifact?.knownIssues));
  const gateKnownIssues = Object.values(gates).flatMap((gate) => toArray(gate?.knownIssues));
  const voiceNetwork = artifacts.voiceNetworkBargeIn || {};
  const nextQuestionFirstAudioMs = Number(voiceNetwork.nextQuestionFirstAudioMs);
  const voiceSloKnownIssue = Number.isFinite(nextQuestionFirstAudioMs) && nextQuestionFirstAudioMs > 3000;

  return unique([
    ...artifactKnownIssues,
    ...gateKnownIssues,
    ...(voiceSloKnownIssue ? ['voice_next_question_3s_slo_exceeded'] : []),
  ]);
};

const buildVoiceSloGate = (voiceNetworkArtifact = null) => {
  const nextQuestionFirstAudioMs = Number(voiceNetworkArtifact?.nextQuestionFirstAudioMs);
  if (!Number.isFinite(nextQuestionFirstAudioMs)) {
    return { status: 'not_measured', targetMs: 3000, nextQuestionFirstAudioMs: null };
  }

  return {
    status: nextQuestionFirstAudioMs > 3000 ? 'known_issue' : 'passed',
    targetMs: 3000,
    nextQuestionFirstAudioMs,
  };
};

export const buildE2eRefineReleaseGateSummary = (artifacts = {}) => {
  const gates = Object.fromEntries(Object.entries(ARTIFACT_CONTRACTS).map(([key, contract]) => [
    key,
    buildGate({ artifact: artifacts[key] || null, contract, key }),
  ]));
  const releaseBlockers = unique(collectGateBlockers(gates));
  const knownIssues = collectKnownIssues({ artifacts, gates });

  return {
    schemaVersion: 'e2e_refine_release_gate_report_v1',
    generatedAt: new Date().toISOString(),
    releaseStatus: releaseBlockers.length
      ? 'blocked'
      : knownIssues.length ? 'ready_with_known_issues' : 'ready',
    releaseBlockers,
    knownIssues,
    external: EXTERNAL_BOUNDARIES,
    gates: {
      ...gates,
      voiceThreeSecondSlo: buildVoiceSloGate(artifacts.voiceNetworkBargeIn || null),
    },
    requiredArtifacts: Object.fromEntries(Object.entries(ARTIFACT_CONTRACTS).map(([key, contract]) => [
      key,
      {
        label: contract.label,
        filename: contract.filename,
        requiredAssertions: contract.requiredAssertions,
      },
    ])),
  };
};

const renderMarkdown = (summary = {}) => {
  const gateLines = Object.entries(summary.gates || {})
    .map(([key, gate]) => `- ${key}: ${gate.status}`)
    .join('\n');

  return [
    '# E2E Refine Release Gate',
    '',
    `- Status: ${summary.releaseStatus}`,
    `- Release blockers: ${summary.releaseBlockers?.length ? summary.releaseBlockers.join(', ') : 'none'}`,
    `- Known issues: ${summary.knownIssues?.length ? summary.knownIssues.join(', ') : 'none'}`,
    `- External boundaries: ${summary.external?.length ? summary.external.join(', ') : 'none'}`,
    '',
    '## Gates',
    '',
    gateLines,
    '',
    'This gate validates synthetic local E2E artifacts only. It does not claim live speech provider SLO, real LLM semantic quality, or production retention telemetry.',
  ].join('\n');
};

export const runE2eRefineReleaseGateEvaluation = async ({
  backendRoot = path.resolve('.'),
  artifactRoot = path.join(backendRoot, '../output/playwright'),
  reportRoot = path.join(backendRoot, 'eval/reports'),
} = {}) => {
  const artifactEntries = await Promise.all(Object.entries(ARTIFACT_CONTRACTS).map(async ([key, contract]) => [
    key,
    await readOptionalJsonFile(path.join(artifactRoot, contract.filename)),
  ]));
  const artifacts = Object.fromEntries(artifactEntries);
  const summary = buildE2eRefineReleaseGateSummary(artifacts);

  await fs.mkdir(reportRoot, { recursive: true });
  await fs.writeFile(path.join(reportRoot, 'e2e-refine-release-gate.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(path.join(reportRoot, 'e2e-refine-release-gate.latest.md'), `${renderMarkdown(summary)}\n`);
  return summary;
};
