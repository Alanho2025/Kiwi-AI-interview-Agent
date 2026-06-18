/**
 * File responsibility: Build Google Agents CLI traces for question-agent behavior.
 * Main responsibilities:
 * - Execute deterministic question-controller, ranker, and turn-planning scenarios.
 * - Convert stage outputs into EvaluationDataset trace JSON.
 * - Write a trace artifact that `agents-cli eval grade` can consume.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { buildQuestionAgentDataset } from '../googleAgentsCli/questionAgentTraceBuilder.js';

process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.AI_TEST_MODE = process.env.AI_TEST_MODE || 'mock';
process.env.DISABLE_MODEL_ACTION_SELECTION = process.env.DISABLE_MODEL_ACTION_SELECTION || 'true';

const repoRoot = path.resolve('.');
const defaultOutputPath = path.join(repoRoot, 'eval/googleAgentsCli/traces/question-agent-trace.json');

const getArgValue = (flagName = '', argv = []) => {
  const flagIndex = argv.indexOf(flagName);
  if (flagIndex === -1) return '';
  return argv[flagIndex + 1] || '';
};

const writeDataset = async ({ dataset, outputPath }) => {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(dataset, null, 2)}\n`);
};

const summarizeAverage = (dataset = {}) => {
  const scores = (dataset.eval_cases || [])
    .map((item) => Number(item.kiwi_evaluation?.score))
    .filter((score) => Number.isFinite(score));
  return scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : 0;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const outputPath = path.resolve(getArgValue('--output', argv) || defaultOutputPath);
  const dataset = await buildQuestionAgentDataset();
  await writeDataset({ dataset, outputPath });

  console.log('Google Agents CLI question-agent trace built.');
  console.log(`Cases: ${dataset.eval_cases.length}`);
  console.log(`Average deterministic score: ${summarizeAverage(dataset)}`);
  console.log(`Trace: ${outputPath}`);
};

main().catch((error) => {
  console.error('Failed to build Google Agents CLI question-agent trace.');
  console.error(error);
  process.exit(1);
});
