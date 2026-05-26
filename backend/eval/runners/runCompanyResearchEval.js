import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runCompanyResearchEval } from '../helpers/companyResearchJudge.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/company-research/company-research-eval.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'companyResearch' });

const summary = await runCompanyResearchEval({ datasetPath, reportRoot, thresholds: options, label: 'Company Research Eval' });

console.log('Company research eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
