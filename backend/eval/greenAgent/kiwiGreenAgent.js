/**
 * File responsibility: Green-agent orchestration for Kiwi Interview Agent evaluation.
 * Main responsibilities:
 * - Load benchmark scenarios, run product-level checks, and aggregate results.
 * - Model the Week 8 green-agent idea with deterministic local code.
 * - Keep the evaluator independent from production routes and databases.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { runInterviewScenario } from './scenarioRunner.js';
import { aggregateEvalResults } from './metricAggregator.js';
import { renderGreenAgentMarkdown } from './failureReporter.js';
import { expandInterviewScenariosToPlanCoverage } from './scenarioExpander.js';

const readJson = async (filePath) => JSON.parse(await fs.readFile(filePath, 'utf8'));

export const runKiwiGreenAgent = async ({ datasetPath, reportRoot, thresholds = {}, label = 'Kiwi Green Agent Eval' } = {}) => {
  const seedScenarios = await readJson(datasetPath);
  const scenarios = expandInterviewScenariosToPlanCoverage(seedScenarios);
  const results = scenarios.map((scenario) => runInterviewScenario(scenario));
  const summary = aggregateEvalResults({ results, thresholds, label });
  if (reportRoot) {
    await fs.mkdir(reportRoot, { recursive: true });
    const safeName = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    await fs.writeFile(path.join(reportRoot, `${safeName}.latest.json`), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, `${safeName}.latest.md`), `${renderGreenAgentMarkdown(summary)}\n`);
  }
  return summary;
};