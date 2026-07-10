import fs from 'node:fs/promises';
import path from 'node:path';

import { averageScores, roundMetric } from './evaluationSummary.js';
import { runGenerationGroundingCases } from './generationGroundingEvaluator.js';
import { runRuntimeRetrievalCases } from './runtimeRetrievalEvaluator.js';

const renderMetricRows = (metrics = {}) => Object.entries(metrics)
  .map(([name, value]) => `| ${name} | ${value} |`);

const renderMarkdown = (summary = {}) => [
  '# Runtime Retrieval and Generation Grounding Eval',
  '',
  `- Retrieval dataset: ${summary.retrieval.datasetVersion}`,
  `- Generation dataset: ${summary.generation.datasetVersion}`,
  `- Cases run: ${summary.casesRun}`,
  `- Combined average: ${summary.average}`,
  `- Calibration status: ${summary.calibration.status}`,
  `- Numerical release threshold: ${summary.calibration.thresholdDecision}`,
  '',
  '## Retrieval metrics',
  '| Metric | Value |',
  '|---|---:|',
  ...renderMetricRows(summary.retrieval.metrics),
  '',
  '## Generation grounding metrics',
  '| Metric | Value |',
  '|---|---:|',
  ...renderMetricRows(summary.generation.metrics),
  '',
  '## Important interpretation',
  '',
  'This report executes the production fusion ranker through its deterministic in-memory adapter. Generation grounding is a separate claim-level evaluation. Human calibration is required before these scores become numerical release thresholds.',
].join('\n');

export const runRoleFitRagEvaluationSuite = async ({
  retrievalDatasetPath,
  generationDatasetPath,
  reportRoot,
} = {}) => {
  const [retrievalDataset, generationDataset] = await Promise.all([
    fs.readFile(retrievalDatasetPath, 'utf8').then(JSON.parse),
    fs.readFile(generationDatasetPath, 'utf8').then(JSON.parse),
  ]);
  const [retrieval, generation] = await Promise.all([
    runRuntimeRetrievalCases(retrievalDataset),
    Promise.resolve(runGenerationGroundingCases(generationDataset)),
  ]);
  const resultScores = [
    ...retrieval.results,
    ...generation.results,
  ];
  const summary = {
    schemaVersion: 'role_fit_rag_eval_report_v1',
    generatedAt: new Date().toISOString(),
    casesRun: resultScores.length,
    average: averageScores(resultScores),
    configFingerprints: {
      retrieval: retrieval.configFingerprint,
      generationRetrieval: [...new Set(generation.results.map((result) => result.configFingerprint))],
    },
    calibration: {
      status: 'pending_human_review',
      thresholdDecision: 'not_set',
    },
    retrieval,
    generation,
  };

  if (reportRoot) {
    await fs.mkdir(reportRoot, { recursive: true });
    await fs.writeFile(path.join(reportRoot, 'retrieval-eval.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'retrieval-eval.latest.md'), `${renderMarkdown(summary)}\n`);
  }

  return {
    ...summary,
    average: roundMetric(summary.average),
    results: resultScores,
  };
};
