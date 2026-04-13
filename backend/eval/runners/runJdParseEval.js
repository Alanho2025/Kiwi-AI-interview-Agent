import fs from 'node:fs/promises';
import path from 'node:path';
import { buildStructuredJobDescriptionRubric } from '../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { scoreJdParseCase } from '../helpers/jdParseEvalScorer.js';

process.env.DISABLE_AI_JD_ENHANCEMENT = 'true';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/jd-parse-eval.json');
const fixtureRoot = path.join(repoRoot, 'tests/fixtures/jobDescription');
const reportRoot = path.join(repoRoot, 'eval/reports');

const parseArgs = (argv = []) => {
  const options = { minAverage: 0, failBelow: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--min-average') options.minAverage = Number(argv[index + 1] || 0);
    if (value === '--fail-below') options.failBelow = Number(argv[index + 1] || 0);
  }
  return options;
};

const options = parseArgs(process.argv.slice(2));
const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = [];

for (const item of dataset) {
  const rawJD = await fs.readFile(path.join(fixtureRoot, item.fixture), 'utf8');
  const rubric = await buildStructuredJobDescriptionRubric(rawJD);
  const score = scoreJdParseCase(rubric, item.expected);
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
const jsonPath = path.join(reportRoot, 'jd-parse-eval.latest.json');
const mdPath = path.join(reportRoot, 'jd-parse-eval.latest.md');
await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);

const markdown = [
  '# JD Parse Eval Summary',
  '',
  `- Cases run: ${summary.casesRun}`,
  `- Average score: ${summary.average}`,
  `- Min average gate: ${options.minAverage}`,
  `- Per-case fail gate: ${options.failBelow}`,
  '',
  '## Case results',
  ...summary.results.map((item) => `- ${item.id}: ${item.score} (${item.earned}/${item.possible})${item.failedChecks.length ? ` | failed: ${item.failedChecks.join(', ')}` : ''}`),
  '',
].join('\n');
await fs.writeFile(mdPath, `${markdown}\n`);

console.log('JD parse eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown report: ${mdPath}`);

const averageFailed = options.minAverage > 0 && average < options.minAverage;
const caseFailed = options.failBelow > 0 && results.some((item) => item.score < options.failBelow);
if (averageFailed || caseFailed) process.exit(1);
