import fs from 'node:fs/promises';
import path from 'node:path';

import { CompanyValuesProfile } from '../../src/db/models/companyValuesProfileModel.js';
import { InterviewQuestionPoolItem } from '../../src/db/models/interviewQuestionPoolItemModel.js';
import { SessionAnalysis } from '../../src/db/models/sessionAnalysisModel.js';
import { SessionReport } from '../../src/db/models/sessionReportModel.js';
import { buildMongoRetentionModelRegistry } from '../../src/repositories/mongoRetentionModelRegistry.js';

const REQUIRED_ROLE_FIT_COLLECTIONS = [
  'companyvaluesprofiles',
  'interviewplans',
  'interviewquestionpoolitems',
  'matchanalysisrecords',
  'sessionanalyses',
  'sessionreports',
];

const RELEASE_BLOCKERS = {
  calibration: 'human_calibration_not_ready',
  adversarial: 'adversarial_gate_not_ready',
  cutoverRetention: 'cutover_retention_contract_not_ready',
  browserVisual: 'browser_visual_not_run',
  voiceFlow: 'voice_flow_not_run',
};

const PRIVATE_MODELS = [
  { name: 'CompanyValuesProfile', model: CompanyValuesProfile },
  { name: 'InterviewQuestionPoolItem', model: InterviewQuestionPoolItem },
  { name: 'SessionAnalysis', model: SessionAnalysis },
  { name: 'SessionReport', model: SessionReport },
];

const readJsonFile = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

const readOptionalJsonFile = async (filePath) => {
  if (!filePath) return null;
  try {
    return await readJsonFile(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
};

const hasPrivateRetentionContract = (model) => Boolean(
  model?.schema?.path('retentionUntil')
  && model.schema.path('deletedAt')
  && model.schema.path('containsSensitiveData')?.defaultValue === true
  && model.schema.path('accessScope')?.defaultValue === 'private'
  && model.schema.path('userId')
);

const buildGate = (status, detail = {}) => ({
  status,
  ...detail,
});

const firstFinite = (...values) => values
  .map((value) => Number(value))
  .find((value) => Number.isFinite(value));

const renderMarkdown = (summary = {}) => [
  '# Role-Fit Release Gate',
  '',
  `- Status: ${summary.releaseStatus}`,
  `- Final claim allowed: ${summary.finalClaimAllowed ? 'yes' : 'no'}`,
  `- Release blockers: ${summary.releaseBlockers.length ? summary.releaseBlockers.join(', ') : 'none'}`,
  `- Known issues: ${summary.knownIssues.length ? summary.knownIssues.join(', ') : 'none'}`,
  '',
  '## Gates',
  '',
  `- Human calibration: ${summary.gates?.calibration?.status || 'unknown'}`,
  `- Adversarial dataset: ${summary.gates?.adversarial?.status || 'unknown'}`,
  `- Cutover retention contract: ${summary.gates?.cutoverRetention?.status || 'unknown'}`,
  `- Browser visual: ${summary.gates?.browserVisual?.status || 'unknown'}`,
  `- Voice flow: ${summary.gates?.voiceFlow?.status || 'unknown'}`,
  `- Voice 3s next-question SLO: ${summary.gates?.voiceThreeSecondSlo?.status || 'unknown'}`,
  '',
  'The voice flow must still run. The 3-second next-question target is tracked separately as a known product issue when exceeded, not as a blocker for the non-SLO Role-Fit release claim.',
].join('\n');

export const buildRoleFitCutoverRetentionSummary = async ({ backendRoot = path.resolve('.') } = {}) => {
  const registry = buildMongoRetentionModelRegistry();
  const registeredCollections = REQUIRED_ROLE_FIT_COLLECTIONS.filter((collectionName) => registry.has(collectionName));
  const modelContracts = PRIVATE_MODELS.map(({ name, model }) => ({
    name,
    privateRetention: hasPrivateRetentionContract(model),
  }));
  const sourceFiles = [
    'src/services/match/guardedMatchService.js',
    'src/services/cv/cvAnalysisService.js',
  ];
  const source = (await Promise.all(
    sourceFiles.map((relativePath) => fs.readFile(path.join(backendRoot, relativePath), 'utf8'))
  )).join('\n');
  const removedLegacyEntrypoints = ![
    'legacy_reviewed_jd',
    'ROLE_FIT_REPLACEMENT_KILL_SWITCH',
    'ROLE_FIT_LEGACY_READER_ENABLED',
  ].some((token) => source.includes(token));
  const defaultQuestionSchemaVersion = InterviewQuestionPoolItem.schema.path('schemaVersion')?.defaultValue || null;
  const passed = modelContracts.every((item) => item.privateRetention)
    && registeredCollections.length === REQUIRED_ROLE_FIT_COLLECTIONS.length
    && removedLegacyEntrypoints
    && defaultQuestionSchemaVersion === 'v3';

  return {
    schemaVersion: 'role_fit_cutover_retention_contract_v1',
    status: passed ? 'passed' : 'failed',
    generatedAt: new Date().toISOString(),
    modelContracts,
    requiredCollections: REQUIRED_ROLE_FIT_COLLECTIONS,
    registeredCollections,
    removedLegacyEntrypoints,
    defaultQuestionSchemaVersion,
    productionTelemetryAvailable: false,
    productionTelemetryNote: 'Local source and model contracts are verified here. Production retention telemetry requires a live production data source and is not available in this repository run.',
  };
};

export const buildRoleFitReleaseGateSummary = ({
  calibrationSummary = null,
  adversarialSummary = null,
  cutoverRetentionSummary = null,
  browserVisualSummary = null,
  voiceFlowSummary = null,
} = {}) => {
  const calibrationPassed = calibrationSummary?.status === 'calibrated'
    && calibrationSummary.canAssertNumericalReleaseThreshold === true
    && Number(calibrationSummary.reviewedCases || 0) === Number(calibrationSummary.totalCases || 0)
    && Number(calibrationSummary.totalCases || 0) > 0;
  const adversarialPassed = adversarialSummary?.datasetChecksPassed === true
    && adversarialSummary.productionClaimAllowed === true;
  const cutoverRetentionPassed = cutoverRetentionSummary?.status === 'passed';
  const browserVisualPassed = browserVisualSummary?.passed === true;
  const voiceFlowPassed = voiceFlowSummary?.passed === true;
  const assistantFirstAudioMs = Number(voiceFlowSummary?.assistantFirstAudioMs);
  const nextQuestionFirstAudioMs = firstFinite(
    voiceFlowSummary?.nextQuestionFirstAudioMs,
    voiceFlowSummary?.assistantFirstAudioMs,
  );
  const voiceSloKnownIssue = voiceFlowPassed
    && Number.isFinite(nextQuestionFirstAudioMs)
    && nextQuestionFirstAudioMs > 3000;
  const voiceSloPassed = voiceFlowPassed
    && Number.isFinite(nextQuestionFirstAudioMs)
    && nextQuestionFirstAudioMs <= 3000;

  const gateChecks = [
    { blocker: RELEASE_BLOCKERS.calibration, passed: calibrationPassed },
    { blocker: RELEASE_BLOCKERS.adversarial, passed: adversarialPassed },
    { blocker: RELEASE_BLOCKERS.cutoverRetention, passed: cutoverRetentionPassed },
    { blocker: RELEASE_BLOCKERS.browserVisual, passed: browserVisualPassed },
    { blocker: RELEASE_BLOCKERS.voiceFlow, passed: voiceFlowPassed },
  ];
  const releaseBlockers = gateChecks
    .filter((check) => !check.passed)
    .map((check) => check.blocker);
  const knownIssues = voiceSloKnownIssue ? ['voice_next_question_3s_slo_exceeded'] : [];
  const finalClaimAllowed = releaseBlockers.length === 0;

  return {
    schemaVersion: 'role_fit_release_gate_report_v1',
    generatedAt: new Date().toISOString(),
    releaseStatus: finalClaimAllowed
      ? knownIssues.length ? 'ready_with_known_issues' : 'ready'
      : 'blocked',
    finalClaimAllowed,
    releaseBlockers,
    knownIssues,
    gates: {
      calibration: buildGate(calibrationPassed ? 'passed' : 'failed', {
        statusValue: calibrationSummary?.status || 'missing',
        reviewedCases: calibrationSummary?.reviewedCases || 0,
        totalCases: calibrationSummary?.totalCases || 0,
        releaseThreshold: calibrationSummary?.thresholdDecision?.value ?? null,
      }),
      adversarial: buildGate(adversarialPassed ? 'passed' : 'failed', {
        datasetChecksPassed: adversarialSummary?.datasetChecksPassed === true,
        productionClaimAllowed: adversarialSummary?.productionClaimAllowed === true,
        totalCases: adversarialSummary?.totalCases || 0,
      }),
      cutoverRetention: buildGate(cutoverRetentionPassed ? 'passed' : 'failed', {
        productionTelemetryAvailable: cutoverRetentionSummary?.productionTelemetryAvailable === true,
        productionTelemetryNote: cutoverRetentionSummary?.productionTelemetryNote || '',
      }),
      browserVisual: buildGate(browserVisualPassed ? 'passed' : 'not_run', {
        screenshotCount: Number(browserVisualSummary?.screenshotCount || 0),
        assertions: browserVisualSummary?.assertions || [],
      }),
      voiceFlow: buildGate(voiceFlowPassed ? 'passed' : 'not_run', {
        assistantFirstAudioMs: Number.isFinite(assistantFirstAudioMs) ? assistantFirstAudioMs : null,
        nextQuestionFirstAudioMs: Number.isFinite(nextQuestionFirstAudioMs) ? nextQuestionFirstAudioMs : null,
        turnDoneMs: Number.isFinite(Number(voiceFlowSummary?.turnDoneMs)) ? Number(voiceFlowSummary.turnDoneMs) : null,
      }),
      voiceThreeSecondSlo: buildGate(
        voiceSloKnownIssue ? 'known_issue' : voiceSloPassed ? 'passed' : 'not_measured',
        {
          targetMs: 3000,
          assistantFirstAudioMs: Number.isFinite(assistantFirstAudioMs) ? assistantFirstAudioMs : null,
          nextQuestionFirstAudioMs: Number.isFinite(nextQuestionFirstAudioMs) ? nextQuestionFirstAudioMs : null,
        }
      ),
    },
  };
};

export const runRoleFitReleaseGateEvaluation = async ({
  backendRoot = path.resolve('.'),
  calibrationReportPath = path.join(backendRoot, 'eval/reports/human-calibration-eval.latest.json'),
  adversarialReportPath = path.join(backendRoot, 'eval/reports/role-fit-v2-adversarial.latest.json'),
  browserVisualReportPath = path.join(backendRoot, '../output/playwright/role-fit-browser-visual.latest.json'),
  voiceFlowReportPath = path.join(backendRoot, '../output/playwright/voice-real-backend.latest.json'),
  voiceFlowFallbackReportPath = path.join(backendRoot, '../output/playwright/voice-realtime-latency.latest.json'),
  reportRoot = path.join(backendRoot, 'eval/reports'),
} = {}) => {
  const [
    calibrationSummary,
    adversarialSummary,
    cutoverRetentionSummary,
    browserVisualSummary,
    voiceFlowSummary,
  ] = await Promise.all([
    readOptionalJsonFile(calibrationReportPath),
    readOptionalJsonFile(adversarialReportPath),
    buildRoleFitCutoverRetentionSummary({ backendRoot }),
    readOptionalJsonFile(browserVisualReportPath),
    readOptionalJsonFile(voiceFlowReportPath).then(async (summary) => (
      summary || readOptionalJsonFile(voiceFlowFallbackReportPath)
    )),
  ]);

  const summary = buildRoleFitReleaseGateSummary({
    calibrationSummary,
    adversarialSummary,
    cutoverRetentionSummary,
    browserVisualSummary,
    voiceFlowSummary,
  });

  await fs.mkdir(reportRoot, { recursive: true });
  await fs.writeFile(path.join(reportRoot, 'role-fit-release-gate.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(path.join(reportRoot, 'role-fit-release-gate.latest.md'), `${renderMarkdown(summary)}\n`);
  return summary;
};
