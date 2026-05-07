import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runKiwiGreenAgent } from '../greenAgent/kiwiGreenAgent.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/end-to-end-interview-scenarios.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'greenAgent' });

const summary = await runKiwiGreenAgent({ datasetPath, reportRoot, thresholds: options, label: 'Kiwi Green Agent Eval' });

console.log('Kiwi green agent eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`JSON report: ${path.join(reportRoot, 'kiwi-green-agent-eval.latest.json')}`);
console.log(`Markdown report: ${path.join(reportRoot, 'kiwi-green-agent-eval.latest.md')}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
