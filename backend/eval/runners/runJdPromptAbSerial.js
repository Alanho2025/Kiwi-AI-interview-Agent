import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const DEFAULT_REPEAT_COUNT = 3;
const MAX_REPEAT_COUNT = 3;
const LOW_LEVEL_RUNNER = 'eval/runners/runJdPromptAbEval.js';
const TELEMETRY_HELPER = 'eval/helpers/jdPromptAbTelemetry.js';
const SAFEGUARD_SHARED = 'src/services/agenticSafeguards/safeguardShared.js';
const JD_PARSE_GATE = 'src/services/jobDescription/jdParseGateService.js';

const runnerDirectory = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(runnerDirectory, '../..');
const repoRoot = path.resolve(backendRoot, '..');

const isNumericInput = (value) => typeof value === 'number' || typeof value === 'string';

export const parseRepeatCount = (value = undefined) => {
  if (value === undefined) return DEFAULT_REPEAT_COUNT;
  if (!isNumericInput(value) || (typeof value === 'string' && value.trim() === '')) {
    throw new Error('JD_AB_REPEAT_COUNT must be an integer from 1 to 3.');
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > MAX_REPEAT_COUNT) {
    throw new Error('JD_AB_REPEAT_COUNT must be an integer from 1 to 3.');
  }
  return parsed;
};

export const buildSerialRunPlan = (repeatCount = DEFAULT_REPEAT_COUNT) => {
  const parsedRepeatCount = parseRepeatCount(repeatCount);
  const plan = [];

  for (let round = 1; round <= parsedRepeatCount; round += 1) {
    plan.push({ round, variant: 'legacy' });
    plan.push({ round, variant: 'xml' });
  }

  return plan;
};

const roundMetric = (value, digits = 3) => (
  Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null
);

const averageMetric = (values = []) => {
  const numericValues = values.filter((value) => Number.isFinite(Number(value))).map(Number);
  if (!numericValues.length) return null;
  return roundMetric(numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length);
};

const buildMetricDelta = (legacyValue, xmlValue) => {
  const legacy = roundMetric(legacyValue);
  const xml = roundMetric(xmlValue);
  if (legacy === null || xml === null) {
    return { score: null, percentagePoints: null };
  }

  const score = roundMetric(xml - legacy);
  return {
    score,
    percentagePoints: roundMetric(score * 100),
  };
};

const summarizeVariant = (summary = {}) => ({
  label: summary.label || null,
  source: summary.source || null,
  casesRun: Number.isFinite(Number(summary.casesRun)) ? Number(summary.casesRun) : null,
  casesCompleted: Number.isFinite(Number(summary.casesCompleted)) ? Number(summary.casesCompleted) : null,
  average: roundMetric(summary.average),
  criticalAverage: roundMetric(summary.criticalAverage),
  failedCaseCount: Array.isArray(summary.failedCases) ? summary.failedCases.length : 0,
  safeguardReparseCases: Number(summary.safeguardReparseCases) || 0,
  providerTimeoutAttempts: Number(summary.providerTimeoutAttempts) || 0,
  providerFallbackReviews: Number(summary.providerFallbackReviews) || 0,
  providerTimeoutReviews: Number(summary.providerTimeoutReviews) || 0,
});

export const validateChildSummary = (summary = {}) => {
  if (!Number.isInteger(summary.casesRun) || summary.casesRun <= 0) {
    throw new Error('Child summary casesRun must be a positive number.');
  }
  if (summary.casesCompleted !== summary.casesRun) {
    throw new Error('Child summary casesCompleted must equal casesRun.');
  }
  if (!Array.isArray(summary.failedCases) || summary.failedCases.length > 0) {
    throw new Error('Child summary failedCases must be an empty array.');
  }
  return summary;
};

export const aggregateSerialRuns = ({ repeatCount = DEFAULT_REPEAT_COUNT, runs = [] } = {}) => {
  const parsedRepeatCount = parseRepeatCount(repeatCount);
  const rounds = [];

  for (let round = 1; round <= parsedRepeatCount; round += 1) {
    const legacyRun = runs.find((run) => run.round === round && run.variant === 'legacy');
    const xmlRun = runs.find((run) => run.round === round && run.variant === 'xml');
    const legacy = summarizeVariant(legacyRun?.summary);
    const xml = summarizeVariant(xmlRun?.summary);

    rounds.push({
      round,
      order: ['legacy', 'xml'],
      legacy,
      xml,
      delta: {
        average: buildMetricDelta(legacy.average, xml.average),
        criticalAverage: buildMetricDelta(legacy.criticalAverage, xml.criticalAverage),
      },
    });
  }

  const legacyAverage = averageMetric(rounds.map((round) => round.legacy.average));
  const xmlAverage = averageMetric(rounds.map((round) => round.xml.average));
  const legacyCriticalAverage = averageMetric(rounds.map((round) => round.legacy.criticalAverage));
  const xmlCriticalAverage = averageMetric(rounds.map((round) => round.xml.criticalAverage));

  return {
    evaluation: 'JD prompt A/B bounded serial evaluation',
    repeatCount: parsedRepeatCount,
    executionProtocol: {
      providerConcurrency: 'serial',
      legacyMustExitBeforeXml: true,
      caseOrder: 'sequential',
    },
    rounds,
    legacyAverage,
    xmlAverage,
    legacyCriticalAverage,
    xmlCriticalAverage,
    delta: {
      average: buildMetricDelta(legacyAverage, xmlAverage),
      criticalAverage: buildMetricDelta(legacyCriticalAverage, xmlCriticalAverage),
    },
  };
};

const removeSnapshotEnvFiles = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.name === '.env' || entry.name.startsWith('.env.')) {
      await fs.rm(entryPath, { recursive: true, force: true });
    } else if (entry.isDirectory()) {
      await removeSnapshotEnvFiles(entryPath);
    }
  }
};

const copyFileWithParent = async (sourcePath, destinationPath) => {
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  await fs.copyFile(sourcePath, destinationPath);
};

const createLegacySnapshot = async (temporaryRoot) => {
  const archivePath = path.join(temporaryRoot, 'legacy-head.tar');
  const snapshotRoot = path.join(temporaryRoot, 'legacy-snapshot');
  const snapshotBackendRoot = path.join(snapshotRoot, 'backend');

  await fs.mkdir(snapshotRoot, { recursive: true });
  const { stdout: archive } = await execFileAsync('git', ['archive', '--format=tar', 'HEAD'], {
    cwd: repoRoot,
    encoding: null,
    maxBuffer: 512 * 1024 * 1024,
  });
  await fs.writeFile(archivePath, archive);
  await execFileAsync('tar', ['-xf', archivePath, '-C', snapshotRoot], { maxBuffer: 16 * 1024 * 1024 });
  await removeSnapshotEnvFiles(snapshotRoot);

  const currentNodeModules = path.join(backendRoot, 'node_modules');
  const snapshotNodeModules = path.join(snapshotBackendRoot, 'node_modules');
  const nodeModulesStat = await fs.stat(currentNodeModules);
  if (!nodeModulesStat.isDirectory()) {
    throw new Error('Current backend/node_modules directory is required for the legacy snapshot.');
  }
  await fs.mkdir(snapshotBackendRoot, { recursive: true });
  await fs.symlink(
    currentNodeModules,
    snapshotNodeModules,
    process.platform === 'win32' ? 'junction' : 'dir',
  );

  const overlays = [
    LOW_LEVEL_RUNNER,
    TELEMETRY_HELPER,
    SAFEGUARD_SHARED,
    JD_PARSE_GATE,
  ];
  for (const relativePath of overlays) {
    await copyFileWithParent(
      path.join(backendRoot, relativePath),
      path.join(snapshotBackendRoot, relativePath),
    );
  }

  return { snapshotRoot, snapshotBackendRoot };
};

const buildChildEnvironment = ({ variant, round, outputPath }) => ({
  ...process.env,
  NODE_ENV: 'test',
  AI_TEST_MODE: 'real',
  AGENTIC_SAFEGUARDS_ENABLED: 'true',
  AGENTIC_SAFEGUARD_MAX_REPARSE_ATTEMPTS: '1',
  JD_AB_LABEL: `${variant}-round-${round}`,
  JD_AB_SOURCE: variant === 'legacy' ? 'legacy-head' : 'working-tree',
  JD_AB_OUTPUT_PATH: outputPath,
  DOTENV_CONFIG_PATH: path.join(backendRoot, '.env'),
});

const waitForChild = (child) => new Promise((resolve, reject) => {
  let settled = false;
  child.once('error', (error) => {
    if (settled) return;
    settled = true;
    reject(error);
  });
  child.once('close', (code, signal) => {
    if (settled) return;
    settled = true;
    resolve({ code, signal });
  });
});

const readChildSummary = async (outputPath, label) => {
  let content;
  try {
    content = await fs.readFile(outputPath, 'utf8');
  } catch {
    throw new Error(`${label} exited without writing its output JSON.`);
  }

  try {
    const summary = JSON.parse(content);
    if (!summary || typeof summary !== 'object' || Array.isArray(summary)) throw new Error('not an object');
    return validateChildSummary(summary);
  } catch {
    throw new Error(`${label} wrote invalid or incomplete output JSON.`);
  }
};

export const runVariant = async ({
  variant,
  round,
  legacyBackendRoot,
  outputDirectory,
}) => {
  const label = `${variant}-round-${round}`;
  const outputPath = path.join(outputDirectory, `${label}.json`);
  const variantBackendRoot = variant === 'legacy' ? legacyBackendRoot : backendRoot;
  const runnerPath = path.join(variantBackendRoot, LOW_LEVEL_RUNNER);
  const child = spawn(process.execPath, ['-r', 'dotenv/config', runnerPath], {
    cwd: variantBackendRoot,
    env: buildChildEnvironment({ variant, round, outputPath }),
    stdio: 'ignore',
  });
  const { code, signal } = await waitForChild(child);

  if (code !== 0) {
    throw new Error(`${label} exited with code ${code ?? 'null'}${signal ? ` (${signal})` : ''}.`);
  }

  return {
    round,
    variant,
    summary: await readChildSummary(outputPath, label),
  };
};

export const runSerialEvaluation = async () => {
  const repeatCount = parseRepeatCount(process.env.JD_AB_REPEAT_COUNT);
  const plan = buildSerialRunPlan(repeatCount);
  const outputPath = path.resolve(
    process.env.JD_AB_SERIAL_OUTPUT_PATH || path.join(backendRoot, 'eval/reports/jd-prompt-ab-serial.latest.json'),
  );
  const temporaryRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'kiwi-jd-prompt-ab-serial-'));
  const outputDirectory = path.join(temporaryRoot, 'outputs');

  try {
    await fs.mkdir(outputDirectory, { recursive: true });
    const { snapshotBackendRoot } = await createLegacySnapshot(temporaryRoot);
    const runs = [];

    for (const plannedRun of plan) {
      runs.push(await runVariant({
        ...plannedRun,
        legacyBackendRoot: snapshotBackendRoot,
        outputDirectory,
      }));
    }

    const aggregate = aggregateSerialRuns({ repeatCount, runs });
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, `${JSON.stringify(aggregate, null, 2)}\n`);
    console.log(JSON.stringify({ ...aggregate, outputPath }, null, 2));
    return aggregate;
  } finally {
    await fs.rm(temporaryRoot, { recursive: true, force: true });
  }
};

const isMainModule = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMainModule) {
  runSerialEvaluation().catch((error) => {
    console.error(`JD serial A/B runner failed: ${error.message}`);
    process.exitCode = 1;
  });
}
