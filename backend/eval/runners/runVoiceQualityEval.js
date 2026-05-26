import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runVoiceQualityEval } from '../helpers/voiceQualityJudge.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/voice-quality/voice-quality-eval.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'voiceQuality' });

const summary = await runVoiceQualityEval({ datasetPath, reportRoot, thresholds: options, label: 'Voice Quality Eval' });

console.log('Voice quality eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
