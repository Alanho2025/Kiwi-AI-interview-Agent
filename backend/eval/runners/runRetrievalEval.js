import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runRetrievalEval } from '../helpers/retrievalJudge.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/rag-grounding/retrieval-eval.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'retrieval' });

const summary = await runRetrievalEval({ datasetPath, reportRoot, thresholds: options, label: 'Retrieval Eval' });

console.log('Retrieval eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
