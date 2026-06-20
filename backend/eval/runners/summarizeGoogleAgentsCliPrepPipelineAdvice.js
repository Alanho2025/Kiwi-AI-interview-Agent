/**
 * File responsibility: Summarize Google Agents CLI prep pipeline results into advice.
 * Main responsibilities:
 * - Read a Google eval results JSON file.
 * - Extract deterministic and judge explanations per case.
 * - Write a compact Markdown action report for engineering follow-up.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve('.');
const defaultResultsDir = path.join(repoRoot, 'eval/googleAgentsCli/results');
const defaultOutputPath = path.join(repoRoot, 'eval/googleAgentsCli/reports/prep-pipeline-advice.latest.md');

const getArgValue = (flagName = '', argv = []) => {
  const flagIndex = argv.indexOf(flagName);
  if (flagIndex === -1) return '';
  return argv[flagIndex + 1] || '';
};

const latestJsonFile = async (directory) => {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /^results_.*\.json$/.test(entry.name))
    .map((entry) => path.join(directory, entry.name))
    .sort();
  return files.at(-1) || '';
};

const metricSummary = (metricResults = {}) => Object.values(metricResults).map((metric = {}) => ({
  name: metric.metric_name || metric.metricName || 'unknown_metric',
  score: metric.score ?? null,
  explanation: metric.explanation || metric.error_message || '',
}));

const isInfrastructureError = (text = '') => /\b(PERMISSION_DENIED|BILLING_DISABLED|SERVICE_DISABLED|requires billing|API .* disabled)\b/i.test(String(text || ''));
const actionableMetrics = (metrics = []) => metrics.filter((metric) => !isInfrastructureError(metric.explanation));
const infrastructureMetrics = (metrics = []) => metrics.filter((metric) => isInfrastructureError(metric.explanation));

const caseIdAt = (result = {}, index = 0) => {
  const cases = result.evaluation_dataset?.[0]?.eval_cases || [];
  return cases[index]?.eval_case_id || `case_${index}`;
};

const priorityFor = (metrics = []) => {
  const actionable = actionableMetrics(metrics);
  if (actionable.some((metric) => Number(metric.score) < 0.6)) return 'P1';
  if (actionable.some((metric) => Number(metric.score) < 0.8)) return 'P2';
  if (actionable.some((metric) => /failed_checks=(?!none)/i.test(metric.explanation))) return 'P2';
  return 'P3';
};

const moduleHintFor = (text = '') => {
  const value = String(text || '').toLowerCase();
  if (value.includes('failed_checks=none')) return 'No deterministic agent issue';
  if (value.includes('jd:') || value.includes('jd parse') || value.includes('requirement')) return 'JD parser / JD safeguard';
  if (value.includes('cv:') || value.includes('cv parse')) return 'CV parser';
  if (value.includes('match:') || value.includes('overconfiden') || value.includes('score') || value.includes('decision')) return 'Match scoring / match critic';
  if (value.includes('question') || value.includes('priority topic')) return 'Question plan hints';
  return 'Prep pipeline trace review';
};

const renderMarkdown = ({ resultPath, result }) => {
  const lines = [
    '# Google Agents CLI Prep Pipeline Advice',
    '',
    `Source result: ${resultPath}`,
    '',
    '## Summary',
    '',
  ];

  for (const summary of result.summary_metrics || []) {
    lines.push(`- ${summary.metric_name}: mean ${summary.mean_score ?? 'n/a'} (${summary.num_cases_valid ?? 0}/${summary.num_cases_total ?? 0} valid)`);
  }

  lines.push('', '## Case Advice', '');

  for (const caseResult of result.eval_case_results || []) {
    const caseId = caseIdAt(result, caseResult.eval_case_index);
    const candidate = caseResult.response_candidate_results?.[0] || {};
    const metrics = metricSummary(candidate.metric_results || {});
    const infrastructure = infrastructureMetrics(metrics);
    const joinedExplanations = actionableMetrics(metrics).map((metric) => metric.explanation).filter(Boolean).join(' ');
    const priority = priorityFor(metrics);
    const moduleHint = moduleHintFor(joinedExplanations);

    lines.push(`### ${priority}: ${caseId}`);
    lines.push('');
    lines.push(`- Suggested area: ${moduleHint}`);
    for (const metric of actionableMetrics(metrics)) {
      lines.push(`- ${metric.name}: ${metric.score ?? 'n/a'}${metric.explanation ? ` — ${metric.explanation}` : ''}`);
    }
    if (infrastructure.length) {
      lines.push(`- Blocked Google metrics: ${infrastructure.map((metric) => metric.name).join(', ')}`);
      lines.push('- Infrastructure blocker: Google managed/LLM judge metrics require Agent Platform API access with billing enabled on the selected project.');
    }
    lines.push('- Suggested fix: inspect the trace events for the stage above, then tighten parser extraction, safeguard critic instructions, scoring weights, or evidence requirements based on the failing metric rationale.');
    lines.push('- Suggested tests: add or update a focused eval fixture that reproduces the failed check before changing product logic.');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

const main = async () => {
  const argv = process.argv.slice(2);
  const explicitResult = getArgValue('--results', argv);
  const resultPath = path.resolve(explicitResult || await latestJsonFile(defaultResultsDir));
  const outputPath = path.resolve(getArgValue('--output', argv) || defaultOutputPath);
  if (!resultPath) throw new Error(`No results_*.json file found in ${defaultResultsDir}`);

  const result = JSON.parse(await fs.readFile(resultPath, 'utf8'));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderMarkdown({ resultPath, result }));

  console.log('Google Agents CLI prep pipeline advice written.');
  console.log(`Advice: ${outputPath}`);
};

main().catch((error) => {
  console.error('Failed to summarize Google Agents CLI prep pipeline advice.');
  console.error(error);
  process.exit(1);
});
