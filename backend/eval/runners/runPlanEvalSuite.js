import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve('.');
const reportRoot = path.join(repoRoot, 'eval/reports');

const suites = [
  { id: 'cv-parse-eval', command: 'npm', args: ['run', 'eval:cv'] },
  { id: 'jd-parse-eval', command: 'npm', args: ['run', 'eval:jd'] },
  { id: 'jd-parse-seek-benchmark', command: 'npm', args: ['run', 'eval:seek'] },
  { id: 'cv-jd-match-eval', command: 'npm', args: ['run', 'eval:match'] },
  { id: 'interview-controller-eval', command: 'npm', args: ['run', 'eval:interview'] },
  { id: 'report-qa-eval', command: 'npm', args: ['run', 'eval:report'] },
  { id: 'baseline-comparison-eval', command: 'npm', args: ['run', 'eval:baseline'] },
  { id: 'end-to-end-interview-eval', command: 'npm', args: ['run', 'eval:e2e'] },
  { id: 'kiwi-green-agent-eval', command: 'npm', args: ['run', 'eval:green'] },
  { id: 'voice-robustness-eval', command: 'npm', args: ['run', 'eval:voice-robustness'] },
  { id: 'retrieval-eval', command: 'npm', args: ['run', 'eval:retrieval'] },
  { id: 'agent-trajectory-eval', command: 'npm', args: ['run', 'eval:agent-trajectory'] },
  { id: 'company-research-eval', command: 'npm', args: ['run', 'eval:company-research'] },
  { id: 'voice-quality-eval', command: 'npm', args: ['run', 'eval:voice-quality'] },
  { id: 'stability-eval', command: 'npm', args: ['run', 'eval:stability'] },
];

const runCommand = (suite) => new Promise((resolve) => {
  const child = spawn(suite.command, suite.args, {
    cwd: repoRoot,
    env: process.env,
    shell: process.platform === 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    const text = chunk.toString();
    stdout += text;
    process.stdout.write(text);
  });
  child.stderr.on('data', (chunk) => {
    const text = chunk.toString();
    stderr += text;
    process.stderr.write(text);
  });
  child.on('close', (code) => {
    resolve({
      id: suite.id,
      command: `${suite.command} ${suite.args.join(' ')}`,
      exitCode: code,
      passedProcess: code === 0,
      stdoutTail: stdout.slice(-1200),
      stderrTail: stderr.slice(-1200),
    });
  });
});

const safeReadJson = async (filePath) => {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (_error) {
    return null;
  }
};

const buildMarkdown = (summary) => [
  '# Plan Eval Suite Summary',
  '',
  `- Suites attempted: ${summary.suitesAttempted}`,
  `- Reports available: ${summary.reportsAvailable}`,
  `- Process pass rate: ${summary.processPassRate}`,
  `- Report average score: ${summary.reportAverageScore}`,
  '',
  '## Suite results',
  '| Suite | Process | Report | Cases | Average |',
  '|---|---|---|---:|---:|',
  ...summary.results.map((item) => `| ${item.id} | ${item.passedProcess ? 'pass' : 'failed'} | ${item.reportFound ? 'found' : 'missing'} | ${item.casesRun ?? '-'} | ${item.average ?? '-'} |`),
  '',
].join('\n');

await fs.mkdir(reportRoot, { recursive: true });

const results = [];
for (const suite of suites) {
  console.log(`\n[plan-eval] Running ${suite.id}...`);
  const processResult = await runCommand(suite);
  const report = await safeReadJson(path.join(reportRoot, `${suite.id}.latest.json`));
  results.push({
    ...processResult,
    reportFound: Boolean(report),
    casesRun: report?.casesRun ?? null,
    average: report?.average ?? null,
    criticalAverage: report?.criticalAverage ?? null,
    thresholds: report?.thresholds ?? null,
  });
}

const availableReports = results.filter((item) => item.reportFound);
const reportScores = availableReports.map((item) => Number(item.average)).filter((value) => Number.isFinite(value));
const summary = {
  label: 'Plan Eval Suite Summary',
  generatedAt: new Date().toISOString(),
  suitesAttempted: results.length,
  reportsAvailable: availableReports.length,
  processPassRate: results.length ? Number((results.filter((item) => item.passedProcess).length / results.length).toFixed(2)) : 0,
  reportAverageScore: reportScores.length ? Number((reportScores.reduce((sum, value) => sum + value, 0) / reportScores.length).toFixed(2)) : 0,
  results,
};

await fs.writeFile(path.join(reportRoot, 'plan-eval-suite.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(path.join(reportRoot, 'plan-eval-suite.latest.md'), `${buildMarkdown(summary)}\n`);

console.log('\nPlan eval suite complete.');
console.log(`Suites attempted: ${summary.suitesAttempted}`);
console.log(`Reports available: ${summary.reportsAvailable}`);
console.log(`Process pass rate: ${summary.processPassRate}`);

const failed = results.filter((item) => !item.passedProcess || !item.reportFound);
if (failed.length) {
  console.error('[plan-eval] Some suites failed or did not write reports:');
  failed.forEach((item) => console.error(`- ${item.id}: process=${item.exitCode}, reportFound=${item.reportFound}`));
  process.exit(1);
}
