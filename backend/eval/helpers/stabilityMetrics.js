/**
 * File responsibility: Multi-trial stability evaluation.
 * Main responsibilities:
 * - Measure average score, worst score, passAt3, passPower3, and stability gap.
 * - Catch cases where one lucky pass hides unreliable behaviour.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const renderMarkdown = (summary = {}) => {
  const lines = [
    `# Stability Eval`,
    ``,
    `Cases run: ${summary.casesRun}`,
    `Average score: ${summary.average}`,
    ``,
    `| Case | Average | Worst | Gap | passAt3 | passPower3 | Failed checks |`,
    `|---|---:|---:|---:|---|---|---|`,
  ];
  for (const result of summary.results || []) {
    lines.push(`| ${result.id} | ${result.average} | ${result.worstScore} | ${result.stabilityGap} | ${result.passAt3} | ${result.passPower3} | ${(result.failedChecks || []).join(', ') || '-'} |`);
  }
  return lines.join('\n');
};

export const judgeStabilityCase = (scenario = {}) => {
  const trials = scenario.trials || [];
  const expected = scenario.expected || {};
  const scores = trials.map((trial) => Number(trial.score || 0));

  const average = scores.length ? Number((scores.reduce((sum, score) => sum + score, 0) / scores.length).toFixed(2)) : 0;
  const worstScore = scores.length ? Number(Math.min(...scores).toFixed(2)) : 0;
  const bestScore = scores.length ? Number(Math.max(...scores).toFixed(2)) : 0;
  const stabilityGap = Number((bestScore - worstScore).toFixed(2));
  const passAt3 = trials.some((trial) => trial.passed === true);
  const passPower3 = trials.length > 0 && trials.every((trial) => trial.passed === true);

  const failedChecks = [];
  if (worstScore < Number(expected.minWorstScore || 0)) failedChecks.push('worst_score_below_gate');
  if (stabilityGap > Number(expected.maxStabilityGap || 1)) failedChecks.push('stability_gap_too_high');
  if (expected.requirePassPower3 === true && !passPower3) failedChecks.push('pass_power_3_failed');

  const score = failedChecks.length === 0 ? 1 : Number(Math.max(0, average - (failedChecks.length * 0.2)).toFixed(2));

  return {
    id: scenario.id,
    score,
    average,
    worstScore,
    bestScore,
    stabilityGap,
    passAt3,
    passPower3,
    failedChecks,
    diagnostics: {
      scores,
      trialReasons: trials.map((trial) => trial.reason).filter(Boolean),
    },
  };
};

export const runStabilityEval = async ({ datasetPath, reportRoot, label = 'Stability Eval' } = {}) => {
  const scenarios = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const results = scenarios.map((scenario) => judgeStabilityCase(scenario));
  const average = results.length
    ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2))
    : 0;

  const summary = {
    label,
    generatedAt: new Date().toISOString(),
    casesRun: results.length,
    average,
    results,
  };

  if (reportRoot) {
    await fs.mkdir(reportRoot, { recursive: true });
    await fs.writeFile(path.join(reportRoot, 'stability-eval.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'stability-eval.latest.md'), `${renderMarkdown(summary)}\n`);
  }

  return summary;
};
