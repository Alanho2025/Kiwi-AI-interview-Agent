/**
 * File responsibility: Voice interview-quality evaluation.
 * Main responsibilities:
 * - Check transcript-noise handling, self-correction, filler words, partial transcript safety, and latency fallback.
 * - Evaluate coaching quality, not only microphone or socket infrastructure.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const normalize = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9+#.\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const containsAny = (text = '', items = []) => items.some((item) => normalize(text).includes(normalize(item)));
const containsBlocked = (text = '', items = []) => items.filter((item) => normalize(text).includes(normalize(item)));

const renderMarkdown = (summary = {}) => {
  const lines = [
    `# Voice Quality Eval`,
    ``,
    `Cases run: ${summary.casesRun}`,
    `Average score: ${summary.average}`,
    ``,
    `| Case | Score | Failed checks |`,
    `|---|---:|---|`,
  ];
  for (const result of summary.results || []) {
    lines.push(`| ${result.id} | ${result.score} | ${(result.failedChecks || []).join(', ') || '-'} |`);
  }
  return lines.join('\n');
};

export const judgeVoiceQualityCase = (scenario = {}) => {
  const feedback = scenario.generatedFeedback || '';
  const expected = scenario.expected || {};
  const blockedHits = containsBlocked(feedback, expected.mustNotContain || []);

  const hasRequiredCoachingSignal = (expected.mustContainOneOf || []).length
    ? containsAny(feedback, expected.mustContainOneOf)
    : true;
  const noUnsafePenalty = blockedHits.length === 0;
  const transcriptPresent = Boolean(scenario.voiceTranscript);

  const checks = [
    { label: 'transcript_present', passed: transcriptPresent },
    { label: 'required_coaching_signal_present', passed: hasRequiredCoachingSignal },
    { label: 'no_unsafe_or_over_penalising_feedback', passed: noUnsafePenalty },
  ];

  const earned = checks.filter((check) => check.passed).length;
  const score = Number((earned / checks.length).toFixed(2));

  return {
    id: scenario.id,
    score,
    failedChecks: checks.filter((check) => !check.passed).map((check) => check.label),
    diagnostics: {
      blockedHits,
      voiceTranscript: scenario.voiceTranscript,
      generatedFeedback: feedback,
    },
  };
};

export const runVoiceQualityEval = async ({ datasetPath, reportRoot, label = 'Voice Quality Eval' } = {}) => {
  const scenarios = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const results = scenarios.map((scenario) => judgeVoiceQualityCase(scenario));
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
    await fs.writeFile(path.join(reportRoot, 'voice-quality-eval.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'voice-quality-eval.latest.md'), `${renderMarkdown(summary)}\n`);
  }

  return summary;
};
