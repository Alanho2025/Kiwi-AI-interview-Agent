/**
 * File responsibility: Build Google Agents CLI traces for the Kiwi preparation pipeline.
 * Main responsibilities:
 * - Execute CV parse, guarded JD parse, guarded CV-JD match, and deterministic scoring.
 * - Convert live service outputs to Google EvaluationDataset trace JSON.
 * - Write an eval artifact that `agents-cli eval grade` can consume.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCvProfile } from '../../src/services/cv/cvProfileBuilderService.js';
import { buildGuardedStructuredJobDescriptionRubric } from '../../src/services/jobDescription/guardedJobDescriptionService.js';
import { compareCvToJobDescriptionWithSafeguard } from '../../src/services/match/guardedMatchService.js';
import { scoreCvParseCase } from '../helpers/cvParseEvalScorer.js';
import { scoreJdParseCase } from '../helpers/jdParseEvalScorer.js';
import { scoreCvJdMatchCase } from '../helpers/cvJdMatchEvalScorer.js';
import { buildPrepPipelineDataset, summarizeChecksForEvaluation } from '../googleAgentsCli/prepPipelineTraceBuilder.js';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.AI_TEST_MODE = 'mock';
process.env.ENABLE_AGENTIC_SAFEGUARDS = 'true';
process.env.DISABLE_AI_JD_ENHANCEMENT = 'true';
process.env.DISABLE_MATCH_ARTIFACT_CACHE = 'true';
process.env.MATCH_ENGINE = 'legacy';

const repoRoot = path.resolve('.');
const defaultMatchDatasetPath = path.join(repoRoot, 'eval/datasets/cv-jd-match-eval.json');
const defaultCvDatasetPath = path.join(repoRoot, 'eval/datasets/cv-parse-eval.json');
const defaultJdDatasetPath = path.join(repoRoot, 'eval/datasets/jd-parse-eval.json');
const cvFixtureRoot = path.join(repoRoot, 'tests/fixtures/cv');
const jdFixtureRoot = path.join(repoRoot, 'tests/fixtures/jobDescription');
const defaultOutputPath = path.join(repoRoot, 'eval/googleAgentsCli/traces/prep-pipeline-trace.json');

const getArgValue = (flagName = '', argv = []) => {
  const flagIndex = argv.indexOf(flagName);
  if (flagIndex === -1) return '';
  return argv[flagIndex + 1] || '';
};

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));
const readFixture = async (root, fixture) => fs.readFile(path.join(root, fixture), 'utf8');
const byFixture = (items = [], fixtureKey = 'fixture') => new Map(items.map((item) => [item[fixtureKey], item]));

const runPipelineCase = async ({ item, cvExpectations, jdExpectations }) => {
  const rawCv = await readFixture(cvFixtureRoot, item.cvFixture);
  const rawJD = await readFixture(jdFixtureRoot, item.jdFixture);
  const cvProfile = buildCvProfile(rawCv);
  const jdRubric = await buildGuardedStructuredJobDescriptionRubric(rawJD);
  const matchResult = await compareCvToJobDescriptionWithSafeguard(rawCv, rawJD, jdRubric, {
    userId: 'google-agents-cli-eval',
    disableMatchCache: true,
    matchEngine: 'legacy',
  });

  const cvScore = cvExpectations.has(item.cvFixture)
    ? scoreCvParseCase(cvProfile, cvExpectations.get(item.cvFixture).expected)
    : null;
  const jdScore = jdExpectations.has(item.jdFixture)
    ? scoreJdParseCase(jdRubric, jdExpectations.get(item.jdFixture).expected)
    : null;
  const matchScore = scoreCvJdMatchCase(matchResult, item.expected);

  return {
    id: item.id,
    cvFixture: item.cvFixture,
    jdFixture: item.jdFixture,
    rawCv,
    rawJD,
    cvProfile,
    jdRubric,
    matchResult,
    expected: item.expected,
    evaluation: summarizeChecksForEvaluation({ cvScore, jdScore, matchScore }),
  };
};

const writeDataset = async ({ dataset, outputPath }) => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
};

const main = async () => {
  const argv = process.argv.slice(2);
  const matchDatasetPath = path.resolve(getArgValue('--dataset', argv) || defaultMatchDatasetPath);
  const cvDatasetPath = path.resolve(getArgValue('--cv-dataset', argv) || defaultCvDatasetPath);
  const jdDatasetPath = path.resolve(getArgValue('--jd-dataset', argv) || defaultJdDatasetPath);
  const outputPath = path.resolve(getArgValue('--output', argv) || defaultOutputPath);

  const [matchDataset, cvDataset, jdDataset] = await Promise.all([
    readJson(matchDatasetPath),
    readJson(cvDatasetPath),
    readJson(jdDatasetPath),
  ]);

  const cvExpectations = byFixture(cvDataset, 'fixture');
  const jdExpectations = byFixture(jdDataset, 'fixture');
  const runs = [];

  for (const item of matchDataset) {
    runs.push(await runPipelineCase({ item, cvExpectations, jdExpectations }));
  }

  const dataset = buildPrepPipelineDataset(runs);
  await writeDataset({ dataset, outputPath });

  const average = runs.length
    ? Number((runs.reduce((sum, run) => sum + Number(run.evaluation?.score || 0), 0) / runs.length).toFixed(2))
    : 0;

  console.log('Google Agents CLI prep pipeline trace built.');
  console.log(`Cases: ${dataset.eval_cases.length}`);
  console.log(`Average deterministic score: ${average}`);
  console.log(`Trace: ${outputPath}`);
};

main().catch((error) => {
  console.error('Failed to build Google Agents CLI prep pipeline trace.');
  console.error(error);
  process.exit(1);
});

