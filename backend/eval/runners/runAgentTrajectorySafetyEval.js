import path from 'node:path';

import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runAgentTrajectoryEval } from '../helpers/trajectoryJudge.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/e2e-agent-trajectory/agent-trajectory-scenarios.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'agentTrajectory' });

const summary = await runAgentTrajectoryEval({
  datasetPath,
  reportRoot,
  label: 'Agent Trajectory Fixture Safety Eval',
});

console.log('Agent trajectory fixture safety eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
