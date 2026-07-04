/**
 * File responsibility: Render Google Agents CLI result JSON as engineering advice.
 * Main responsibilities:
 * - Extract per-case metric scores and explanations from agents-cli grade output.
 * - Separate product failures from Google infrastructure/auth errors.
 * - Produce compact Markdown follow-up reports for Kiwi eval domains.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const INFRASTRUCTURE_ERROR_PATTERN = /\b(PERMISSION_DENIED|BILLING_DISABLED|SERVICE_DISABLED|requires billing|API .* disabled|UNAUTHENTICATED|quota|credentials)\b/i;

export const getArgValue = (flagName = '', argv = []) => {
  const flagIndex = argv.indexOf(flagName);
  if (flagIndex === -1) return '';
  return argv[flagIndex + 1] || '';
};

export const latestJsonFile = async (directory) => {
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
  rubricVerdicts: metric.rubric_verdicts || [],
}));

const isInfrastructureError = (text = '') => INFRASTRUCTURE_ERROR_PATTERN.test(String(text || ''));

const actionableMetrics = (metrics = []) => metrics.filter((metric) => !isInfrastructureError(metric.explanation));

const infrastructureMetrics = (metrics = []) => metrics.filter((metric) => isInfrastructureError(metric.explanation));

const caseIdAt = (result = {}, index = 0) => {
  const cases = result.evaluation_dataset?.[0]?.eval_cases || [];
  return cases[index]?.eval_case_id || `case_${index}`;
};

const priorityFor = (metrics = []) => {
  const actionable = actionableMetrics(metrics);
  if (actionable.some((metric) => Number(metric.score) < 0.6)) return 'P1';
  if (actionable.some((metric) => Number(metric.score) < 0.85)) return 'P2';
  if (actionable.some((metric) => /failed_checks=(?!none)/i.test(metric.explanation))) return 'P2';
  return 'P3';
};

const failedRubrics = (metric = {}) => (metric.rubricVerdicts || [])
  .filter((item) => item && item.verdict === false)
  .map((item) => item.evaluated_rubric?.content?.property?.description || item.reasoning || 'rubric failed')
  .slice(0, 3);

const renderMetric = (metric = {}) => {
  const fragments = [`- ${metric.name}: ${metric.score ?? 'n/a'}`];
  if (metric.explanation) fragments.push(`  ${metric.explanation}`);
  const rubrics = failedRubrics(metric);
  if (rubrics.length) fragments.push(`  Failed rubrics: ${rubrics.join(' | ')}`);
  return fragments.join('\n');
};

export const renderGoogleAgentsCliAdvice = ({ resultPath = '', result = {}, title = 'Google Agents CLI Advice', domainHint = 'eval' } = {}) => {
  const lines = [
    `# ${title}`,
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
    const priority = priorityFor(metrics);
    const infrastructure = infrastructureMetrics(metrics);

    lines.push(`### ${priority}: ${caseId}`);
    lines.push('');
    for (const metric of actionableMetrics(metrics)) {
      lines.push(renderMetric(metric));
    }
    if (infrastructure.length) {
      lines.push(`- Blocked Google metrics: ${infrastructure.map((metric) => metric.name).join(', ')}`);
      lines.push('- Infrastructure blocker: Google managed/LLM judge metrics could not complete with the current CLI/project state.');
    }
    lines.push(`- Suggested fix: inspect the ${domainHint} trace events around the lowest-scoring metric, then adjust the product logic or eval fixture only if the trace shows the product behavior is already correct.`);
    lines.push('- Suggested tests: add a focused robustness or trace-builder test that reproduces the failed check before changing product logic.');
    lines.push('');
  }

  return `${lines.join('\n')}\n`;
};

export const writeGoogleAgentsCliAdvice = async ({
  resultsDir,
  outputPath,
  explicitResult = '',
  title,
  domainHint,
} = {}) => {
  const resultPath = path.resolve(explicitResult || await latestJsonFile(resultsDir));
  if (!resultPath) throw new Error(`No results_*.json file found in ${resultsDir}`);
  const result = JSON.parse(await fs.readFile(resultPath, 'utf8'));
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, renderGoogleAgentsCliAdvice({
    resultPath,
    result,
    title,
    domainHint,
  }));
  return { resultPath, outputPath };
};
