/**
 * File responsibility: Central quality gates for repeatable Kiwi agent evaluation.
 * Main responsibilities:
 * - Keep benchmark pass thresholds in one place instead of hiding zero gates in runner files.
 * - Let CLI arguments override defaults for local debugging or stricter CI runs.
 * - Make eval failures mean the product quality contract was not met.
 */

export const QUALITY_GATES = Object.freeze({
  cvParse: { minAverage: 0.9, failBelow: 0.75 },
  jdParse: { minAverage: 0.88, failBelow: 0.75 },
  jdParseSeek: { minAverage: 0.78, failBelow: 0.55, minCriticalAverage: 0.82, criticalFailBelow: 0.5 },
  cvJdMatch: { minAverage: 0.9, failBelow: 0.75 },
  interviewController: { minAverage: 0.95, failBelow: 0.75 },
  reportQa: { minAverage: 0.9, failBelow: 0.75 },
  endToEndInterview: { minAverage: 0.88, failBelow: 0.7 },
  greenAgent: { minAverage: 0.88, failBelow: 0.7 },
});

export const getQualityGate = (name) => ({ ...(QUALITY_GATES[name] || { minAverage: 0, failBelow: 0 }) });
