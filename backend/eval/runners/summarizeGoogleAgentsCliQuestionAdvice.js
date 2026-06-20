/**
 * File responsibility: Summarize Google Agents CLI question-agent results into advice.
 * Main responsibilities:
 * - Read the latest question-agent Google eval result JSON.
 * - Extract deterministic, LLM judge, and built-in metric feedback.
 * - Write a compact Markdown action report for question-pipeline engineering follow-up.
 */

import path from 'node:path';
import { getArgValue, writeGoogleAgentsCliAdvice } from '../googleAgentsCli/googleAgentsCliAdviceReporter.js';

const repoRoot = path.resolve('.');
const defaultResultsDir = path.join(repoRoot, 'eval/googleAgentsCli/results/question-agent');
const defaultOutputPath = path.join(repoRoot, 'eval/googleAgentsCli/reports/question-agent-advice.latest.md');

const main = async () => {
  const argv = process.argv.slice(2);
  const result = await writeGoogleAgentsCliAdvice({
    resultsDir: path.resolve(getArgValue('--results-dir', argv) || defaultResultsDir),
    outputPath: path.resolve(getArgValue('--output', argv) || defaultOutputPath),
    explicitResult: getArgValue('--results', argv),
    title: 'Google Agents CLI Question Agent Advice',
    domainHint: 'question agent',
  });

  console.log('Google Agents CLI question-agent advice written.');
  console.log(`Result: ${result.resultPath}`);
  console.log(`Advice: ${result.outputPath}`);
};

main().catch((error) => {
  console.error('Failed to summarize Google Agents CLI question-agent advice.');
  console.error(error);
  process.exit(1);
});
