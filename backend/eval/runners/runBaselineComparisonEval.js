import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runBaselineComparisonCase, summarizeBaselineComparison } from '../baseline/baselineComparisonEvaluator.js';
import { renderBaselineComparisonMarkdown } from '../baseline/baselineComparisonReporter.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/baseline-comparison-scenarios.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'baselineComparison' });

const scenarios = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = [];
for (const scenario of scenarios) {
  results.push(await runBaselineComparisonCase(scenario));
}
const summary = summarizeBaselineComparison({ results, thresholds: options, label: 'Baseline Comparison Eval' });

await fs.mkdir(reportRoot, { recursive: true });
await fs.writeFile(path.join(reportRoot, 'baseline-comparison.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(path.join(reportRoot, 'baseline-comparison.latest.md'), `${renderBaselineComparisonMarkdown(summary)}\n`);

console.log('Baseline comparison eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Evaluation method: ${summary.evaluationMethod}`);
console.log(`Judge model: ${(summary.judgeModels || []).join(', ') || '-'}`);
console.log(`Kiwi Agent average score: ${summary.average}`);
console.log(`Generic baseline average score: ${summary.baselineAverage}`);
console.log(`Average gain: ${summary.averageGain}`);
console.log(`JSON report: ${path.join(reportRoot, 'baseline-comparison.latest.json')}`);
console.log(`Markdown report: ${path.join(reportRoot, 'baseline-comparison.latest.md')}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
