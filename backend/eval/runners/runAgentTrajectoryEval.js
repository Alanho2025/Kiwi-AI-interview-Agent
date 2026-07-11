import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runRuntimeTrajectoryEvaluation } from '../helpers/runtimeTrajectoryEvaluator.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/e2e-agent-trajectory/runtime-trajectory-v1.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'agentTrajectory' });

const summary = await runRuntimeTrajectoryEvaluation({ datasetPath, reportRoot });

console.log('Runtime agent trajectory eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
