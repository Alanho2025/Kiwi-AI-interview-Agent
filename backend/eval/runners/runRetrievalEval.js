import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runRoleFitRagEvaluationSuite } from '../helpers/roleFitRagEvaluationSuite.js';

const repoRoot = path.resolve('.');
const retrievalDatasetPath = path.join(repoRoot, 'eval/datasets/rag-grounding/runtime-retrieval-v1.json');
const generationDatasetPath = path.join(repoRoot, 'eval/datasets/rag-grounding/generation-grounding-v1.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'retrieval' });

const summary = await runRoleFitRagEvaluationSuite({
  retrievalDatasetPath,
  generationDatasetPath,
  reportRoot,
});

console.log('Runtime retrieval and generation grounding eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
