import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runKiwiGreenAgent } from '../greenAgent/kiwiGreenAgent.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/end-to-end-interview-scenarios.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'endToEndInterview' });

const summary = await runKiwiGreenAgent({ datasetPath, reportRoot, thresholds: options, label: 'End-to-End Interview Eval' });

console.log('End-to-end interview eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`JSON report: ${path.join(reportRoot, 'end-to-end-interview-eval.latest.json')}`);
console.log(`Markdown report: ${path.join(reportRoot, 'end-to-end-interview-eval.latest.md')}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
