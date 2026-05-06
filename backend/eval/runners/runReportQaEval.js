import fs from 'node:fs/promises';
import path from 'node:path';
import { runReportQaAgent } from '../../src/services/agents/reportQaAgent.js';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/report-qa-eval.json');
const reportRoot = path.join(repoRoot, 'eval/reports');


const scoreCase = ({ qa, expected }) => {
  const checks = [
    { label: 'passed', passed: qa.passed === expected.passed },
    ...((expected.qualityFlags || []).map((flag) => ({ label: `qualityFlag:${flag}`, passed: qa.qualityFlags.includes(flag) }))),
  ];
  const earned = checks.filter((item) => item.passed).length;
  return { earned, possible: checks.length, score: Number((earned / checks.length).toFixed(2)), checks };
};

const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'reportQa' });
const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = [];
for (const item of dataset) {
  const qa = await runReportQaAgent({ report: item.report, analysisResult: item.analysisResult, retrievalBundle: { items: [] } });
  const score = scoreCase({ qa, expected: item.expected });
  results.push({
    id: item.id,
    passed: qa.passed,
    score: score.score,
    earned: score.earned,
    possible: score.possible,
    failedChecks: score.checks.filter((check) => !check.passed).map((check) => check.label),
  });
}
const average = results.length ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2)) : 0;
const weakestCases = results.filter((item) => item.score < 1).map((item) => ({ id: item.id, score: item.score, failedChecks: item.failedChecks }));
const summary = { casesRun: results.length, average, weakestCases, thresholds: options, results };
await fs.mkdir(reportRoot, { recursive: true });
const jsonPath = path.join(reportRoot, 'report-qa-eval.latest.json');
const mdPath = path.join(reportRoot, 'report-qa-eval.latest.md');
await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(mdPath, ['# Report QA Eval Summary', '', `- Cases run: ${summary.casesRun}`, `- Average score: ${summary.average}`, '', ...summary.results.map((item) => `- ${item.id}: ${item.score}${item.failedChecks.length ? ` | failed: ${item.failedChecks.join(', ')}` : ''}`), ''].join('\n'));
console.log('Report QA eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown report: ${mdPath}`);
exitIfGateFailed({ average, results, options });
