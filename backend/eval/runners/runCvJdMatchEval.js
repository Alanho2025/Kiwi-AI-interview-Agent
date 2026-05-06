import fs from 'node:fs/promises';
import path from 'node:path';
import { buildStructuredJobDescriptionRubric } from '../../src/services/jobDescription/jobDescriptionRubricBuilder.js';
import { compareCvToJobDescription } from '../../src/services/matchService.js';
import { buildMarkdownTable } from '../helpers/evalShared.js';
import { scoreCvJdMatchCase } from '../helpers/cvJdMatchEvalScorer.js';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';

process.env.DISABLE_AI_JD_ENHANCEMENT = 'true';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/cv-jd-match-eval.json');
const cvFixtureRoot = path.join(repoRoot, 'tests/fixtures/cv');
const jdFixtureRoot = path.join(repoRoot, 'tests/fixtures/jobDescription');
const reportRoot = path.join(repoRoot, 'eval/reports');


const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'cvJdMatch' });
const dataset = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = [];

for (const item of dataset) {
  const rawCv = await fs.readFile(path.join(cvFixtureRoot, item.cvFixture), 'utf8');
  const rawJD = await fs.readFile(path.join(jdFixtureRoot, item.jdFixture), 'utf8');
  const rubric = await buildStructuredJobDescriptionRubric(rawJD);
  const result = await compareCvToJobDescription(rawCv, rawJD, rubric);
  const score = scoreCvJdMatchCase(result, item.expected);
  results.push({
    id: item.id,
    cvFixture: item.cvFixture,
    jdFixture: item.jdFixture,
    decision: result.decision?.label,
    overallScore: result.overallScore,
    score: score.score,
    earned: score.earned,
    possible: score.possible,
    failedChecks: score.checks.filter((check) => !check.passed).map((check) => check.label),
  });
}

const average = results.length ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2)) : 0;
const weakestCases = results.filter((item) => item.score < 0.75).map((item) => ({ id: item.id, score: item.score, decision: item.decision, overallScore: item.overallScore, failedChecks: item.failedChecks }));
const summary = { casesRun: results.length, average, weakestCases, thresholds: options, results };

await fs.mkdir(reportRoot, { recursive: true });
const jsonPath = path.join(reportRoot, 'cv-jd-match-eval.latest.json');
const mdPath = path.join(reportRoot, 'cv-jd-match-eval.latest.md');
await fs.writeFile(jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(mdPath, [
  '# CV ↔ JD Match Eval Summary',
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

console.log('CV ↔ JD match eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`JSON report: ${jsonPath}`);
console.log(`Markdown report: ${mdPath}`);

exitIfGateFailed({ average, results, options });
