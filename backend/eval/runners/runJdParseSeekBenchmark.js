import fs from 'node:fs/promises';
import path from 'node:path';
import { buildStructuredJobDescriptionRubric } from '../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { scoreJdParseCase } from '../helpers/jdParseEvalScorer.js';

process.env.DISABLE_AI_JD_ENHANCEMENT = 'true';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/jd-parse-seek-benchmark.json');
const fixtureRoot = path.join(repoRoot, 'tests/fixtures/jobDescription');
const reportRoot = path.join(repoRoot, 'eval/reports');

const parseArgs = (argv = []) => {
  const options = { minAverage: 0, failBelow: 0, minCriticalAverage: 0, criticalFailBelow: 0 };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--min-average') options.minAverage = Number(argv[index + 1] || 0);
    if (value === '--fail-below') options.failBelow = Number(argv[index + 1] || 0);
    if (value === '--min-critical-average') options.minCriticalAverage = Number(argv[index + 1] || 0);
    if (value === '--critical-fail-below') options.criticalFailBelow = Number(argv[index + 1] || 0);
  }
  return options;
};

const options = parseArgs(process.argv.slice(2));
const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = [];

for (const item of dataset) {
  const rawJD = await fs.readFile(path.join(fixtureRoot, item.fixture), 'utf8');
  const rubric = await buildStructuredJobDescriptionRubric(rawJD);
  const score = scoreJdParseCase(rubric, item.expected, item.weights || {});
  results.push({
    id: item.id,
    fixture: item.fixture,
    score: score.score,
    criticalScore: score.criticalScore,
    earned: score.earned,
    possible: score.possible,
    fieldScores: score.fieldScores,
    failedChecks: score.failedChecks,
  });
}

const average = results.length ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2)) : 0;
const criticalAverage = results.length ? Number((results.reduce((sum, item) => sum + item.criticalScore, 0) / results.length).toFixed(2)) : 0;
const weakestCases = results.filter((item) => item.score < 0.9 || item.criticalScore < 0.9).map((item) => ({ id: item.id, score: item.score, criticalScore: item.criticalScore, failedChecks: item.failedChecks }));
const summary = { casesRun: results.length, average, criticalAverage, weakestCases, thresholds: options, results };

await fs.mkdir(reportRoot, { recursive: true });
const jsonPath = path.join(reportRoot, 'jd-parse-seek-benchmark.latest.json');
const mdPath = path.join(reportRoot, 'jd-parse-seek-benchmark.latest.md');
await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
const markdown = [
  '# JD Parse Seek Benchmark Summary',
  '',
  `- Cases run: ${summary.casesRun}`,
  `- Average score: ${summary.average}`,
  `- Critical average score: ${summary.criticalAverage}`,
  '',
  '## Case results',
  ...summary.results.map((item) => `- ${item.id}: overall=${item.score}, critical=${item.criticalScore}${item.failedChecks.length ? ` | failed: ${item.failedChecks.join(', ')}` : ''}`),
  '',
].join('\n');
await fs.writeFile(mdPath, `${markdown}\n`);
console.log('JD parse Seek benchmark complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`Critical average score: ${summary.criticalAverage}`);
console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown report: ${mdPath}`);

const averageFailed = options.minAverage > 0 && average < options.minAverage;
const caseFailed = options.failBelow > 0 && results.some((item) => item.score < options.failBelow);
const criticalAverageFailed = options.minCriticalAverage > 0 && criticalAverage < options.minCriticalAverage;
const criticalCaseFailed = options.criticalFailBelow > 0 && results.some((item) => item.criticalScore < options.criticalFailBelow);
if (averageFailed || caseFailed || criticalAverageFailed || criticalCaseFailed) process.exit(1);
