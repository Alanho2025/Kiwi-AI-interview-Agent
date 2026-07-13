import 'dotenv/config';
import path from 'node:path';
import { parseEvalArgs, exitIfGateFailed } from '../helpers/evalCli.js';
import { runVoiceTranscriptReviewPolicyEval } from '../helpers/voiceTranscriptReviewPolicyEvaluator.js';

const repoRoot = path.resolve('.');
const datasetPath = path.join(repoRoot, 'eval/datasets/voice-transcript-review-policy-v1.json');
const reportRoot = path.join(repoRoot, 'eval/reports');
const options = parseEvalArgs({ argv: process.argv.slice(2), gateName: 'voiceTranscriptReviewPolicy' });

const summary = await runVoiceTranscriptReviewPolicyEval({
  datasetPath,
  reportRoot,
  thresholds: options,
  label: 'Voice Transcript Review Policy Eval',
});

console.log('Voice transcript review policy eval complete.');
console.log(`Cases run: ${summary.casesRun}`);
console.log(`Average score: ${summary.average}`);
console.log(`Deterministic pass rate: ${summary.deterministicPassRate}`);
console.log(`LLM judge mode: ${summary.llmJudgeMode}`);
console.log(`LLM accept rate: ${summary.llmAcceptRate ?? 'not run'}`);
console.log(`JSON report: ${path.join(reportRoot, 'voice-transcript-review-policy.latest.json')}`);
console.log(`Markdown report: ${path.join(reportRoot, 'voice-transcript-review-policy.latest.md')}`);

exitIfGateFailed({ average: summary.average, results: summary.results, options });
