import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCvProfile } from '../../src/services/cv/cvProfileBuilderService.js';
import { buildMarkdownTable } from '../helpers/evalShared.js';
import { scoreCvParseCase } from '../helpers/cvParseEvalScorer.js';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/cv-parse-eval.json');
const fixtureRoot = path.join(repoRoot, 'tests/fixtures/cv');
const reportRoot = path.join(repoRoot, 'eval/reports');


const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'cvParse' });
const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = [];

for (const item of dataset) {
  const rawCv = await fs.readFile(path.join(fixtureRoot, item.fixture), 'utf8');
  const profile = buildCvProfile(rawCv);
  const score = scoreCvParseCase(profile, item.expected);
  results.push({
    id: item.id,
    fixture: item.fixture,
    score: score.score,
    earned: score.earned,
    possible: score.possible,
    failedChecks: score.checks.filter((check) => !check.passed).map((check) => check.label),
  });
}

const average = results.length ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2)) : 0;
const weakestCases = results.filter((item) => item.score < 0.8).map((item) => ({ id: item.id, score: item.score, failedChecks: item.failedChecks }));
const summary = { casesRun: results.length, average, weakestCases, thresholds: options, results };

await fs.mkdir(reportRoot, { recursive: true });
const jsonPath = path.join(reportRoot, 'cv-parse-eval.latest.json');
const mdPath = path.join(reportRoot, 'cv-parse-eval.latest.md');
await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(mdPath, [
  '# CV Parse Eval Summary',
  '',
  `- Cases run: ${summary.casesRun}`,
  `- Average score: ${summary.average}`,
  `- Min average gate: ${options.minAverage}`,
  `- Per-case fail gate: ${options.failBelow}`,
  '',
  '## Case results',
  buildMarkdownTable(results),
  '',
].join('\n'));

console.log('CV parse eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown report: ${mdPath}`);

exitIfGateFailed({ average, results, options });
