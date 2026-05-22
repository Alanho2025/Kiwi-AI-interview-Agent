/**
 * File responsibility: Deterministic voice robustness evaluator.
 * Main responsibilities:
 * - Exercise the same transcript confidence gate used by duplex voice turns.
 * - Score silence, low-confidence, accented, domain-term, and incomplete transcript cases.
 * - Produce report-ready evidence without calling external STT providers.
 */

import { assessRealtimeVoiceTranscript } from '../../src/services/voice/speechConfidenceGate.js';

const normalize = (value = '') => String(value || '').toLowerCase();

const includesAll = (text = '', terms = []) => terms.every((term) => normalize(text).includes(normalize(term)));

const scoreChecks = (checks = []) => {
  const earned = checks.filter((check) => check.passed).length;
  return {
    earned,
    possible: checks.length,
    score: checks.length ? Number((earned / checks.length).toFixed(2)) : 1,
  };
};

export const runVoiceRobustnessCase = (scenario = {}) => {
  const actual = assessRealtimeVoiceTranscript({
    transcriptText: scenario.transcriptText,
    asrConfidence: scenario.asrConfidence,
    vad: scenario.vad,
  });
  const expected = scenario.expected || {};
  const checks = [
    { label: 'ok_matches_expected', passed: actual.ok === expected.ok },
    { label: 'reason_matches_expected', passed: !expected.reason || actual.reason === expected.reason },
    { label: 'message_contains_expected_terms', passed: includesAll(actual.message || '', expected.messageIncludes || []) },
  ];
  const scored = scoreChecks(checks);

  return {
    id: scenario.id,
    score: scored.score,
    expectedOutcome: expected.ok ? 'accepted' : 'rejected',
    actualOutcome: actual.ok ? 'accepted' : 'rejected',
    expectedReason: expected.reason || null,
    actualReason: actual.reason,
    subScores: {
      decision: checks[0].passed ? 1 : 0,
      reason: checks[1].passed ? 1 : 0,
      message: checks[2].passed ? 1 : 0,
    },
    failedChecks: checks.filter((check) => !check.passed).map((check) => check.label),
    diagnostics: {
      message: actual.message,
      metrics: actual.metrics,
      confidenceGate: actual.confidenceGate,
    },
  };
};

export const summarizeVoiceRobustness = ({ results = [], thresholds = {}, label = 'Voice Robustness Eval' } = {}) => {
  const average = results.length
    ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2))
    : 0;
  const acceptedCases = results.filter((item) => item.actualOutcome === 'accepted').length;
  const rejectedCases = results.filter((item) => item.actualOutcome === 'rejected').length;
  const weakestCases = results
    .filter((item) => item.score < Number(thresholds.failBelow || 0.7))
    .map((item) => ({ id: item.id, score: item.score, failedChecks: item.failedChecks }));

  return {
    label,
    casesRun: results.length,
    average,
    acceptedCases,
    rejectedCases,
    weakestCases,
    thresholds,
    results,
  };
};
