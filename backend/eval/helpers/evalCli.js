/**
 * File responsibility: Shared CLI parsing and gate checks for evaluation runners.
 * Main responsibilities:
 * - Remove duplicated argument parsing across eval scripts.
 * - Apply non-zero default gates unless a runner explicitly overrides them.
 * - Provide consistent failure diagnostics for CI and local quality checks.
 */

import { getQualityGate } from '../config/qualityGates.js';

const numericArgNames = new Set(['minAverage', 'failBelow', 'minCriticalAverage', 'criticalFailBelow']);
const toOptionKey = (flag = '') => flag.replace(/^--/, '').replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

export const parseEvalArgs = ({ argv = [], gateName = '', defaults = {} } = {}) => {
  const options = { ...getQualityGate(gateName), ...defaults };
  for (let index = 0; index < argv.length; index += 1) {
    const key = toOptionKey(argv[index]);
    if (!String(argv[index]).startsWith('--') || !numericArgNames.has(key)) continue;
    const nextValue = Number(argv[index + 1]);
    if (Number.isFinite(nextValue)) {
      options[key] = nextValue;
      index += 1;
    }
  }
  return options;
};

export const getEvalGateFailures = ({ average = 0, results = [], options = {}, criticalAverage = null } = {}) => {
  const failures = [];
  if (Number(options.minAverage || 0) > 0 && average < options.minAverage) failures.push(`average ${average} is below minAverage ${options.minAverage}`);
  if (Number(options.failBelow || 0) > 0) {
    const weakCases = results.filter((item) => Number(item.score || 0) < options.failBelow).map((item) => item.id);
    if (weakCases.length) failures.push(`case score below ${options.failBelow}: ${weakCases.join(', ')}`);
  }
  if (criticalAverage !== null && Number(options.minCriticalAverage || 0) > 0 && criticalAverage < options.minCriticalAverage) failures.push(`criticalAverage ${criticalAverage} is below minCriticalAverage ${options.minCriticalAverage}`);
  if (Number(options.criticalFailBelow || 0) > 0) {
    const weakCriticalCases = results.filter((item) => typeof item.criticalScore === 'number' && item.criticalScore < options.criticalFailBelow).map((item) => item.id);
    if (weakCriticalCases.length) failures.push(`critical score below ${options.criticalFailBelow}: ${weakCriticalCases.join(', ')}`);
  }
  return failures;
};

export const exitIfGateFailed = ({ average = 0, results = [], options = {}, criticalAverage = null } = {}) => {
  const failures = getEvalGateFailures({ average, results, options, criticalAverage });
  if (!failures.length) return;
  console.error('Evaluation gate failed:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
};
