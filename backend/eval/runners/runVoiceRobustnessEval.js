import fs from 'node:fs/promises';
import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runVoiceRobustnessCase, summarizeVoiceRobustness } from '../voice/voiceRobustnessEvaluator.js';
import { renderVoiceRobustnessMarkdown } from '../voice/voiceRobustnessReporter.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/voice-robustness-scenarios.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'voiceRobustness' });

const scenarios = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
const results = scenarios.map((scenario) => runVoiceRobustnessCase(scenario));
const summary = summarizeVoiceRobustness({ results, thresholds: options, label: 'Voice Robustness Eval' });

await fs.mkdir(reportRoot, { recursive: true });
await fs.writeFile(path.join(reportRoot, 'voice-robustness.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
await fs.writeFile(path.join(reportRoot, 'voice-robustness.latest.md'), `${renderVoiceRobustnessMarkdown(summary)}\n`);

console.log('Voice robustness eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`Accepted cases: ${summary.acceptedCases}`);
console.log(`Rejected cases: ${summary.rejectedCases}`);
console.log(`JSON report: ${path.join(reportRoot, 'voice-robustness.latest.json')}`);
console.log(`Markdown report: ${path.join(reportRoot, 'voice-robustness.latest.md')}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
