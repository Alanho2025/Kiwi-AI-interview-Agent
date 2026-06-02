/**
 * File responsibility: Deterministic retrieval and grounding evaluation.
 * Main responsibilities:
 * - Check whether retrieved evidence matches the query and expected evidence.
 * - Detect blocked or unsupported evidence.
 * - Keep semantic retrieval from upgrading weak evidence into hard claims.
 */

import fs from 'node:fs/promises';
import path from 'node:path';

const normalize = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/[^a-z0-9+#.\s-]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const flattenSources = (sources = {}) => Object.entries(sources)
  .flatMap(([sourceType, chunks]) => (chunks || []).map((text) => ({ sourceType, text, normalized: normalize(text) })));

const includesPhrase = (text = '', phrase = '') => normalize(text).includes(normalize(phrase));

const unique = (items = []) => [...new Set(items.filter(Boolean))];

const hasNegatedClaimInstruction = ({ outcome = '', itemText = '' } = {}) => (
  outcome.includes(`do not claim ${itemText}`)
  || outcome.includes(`not claim ${itemText}`)
  || outcome.includes(`avoid claiming ${itemText}`)
  || outcome.includes(`do not treat ${itemText} as supported`)
  || outcome.includes(`not treat ${itemText} as supported`)
);

const outcomeClaimsBlockedEvidence = ({ outcome = '', blockedEvidence = [] } = {}) => {
  const normalizedOutcome = normalize(outcome);
  return blockedEvidence.some((item) => {
    const itemText = normalize(item);
    if (hasNegatedClaimInstruction({ outcome: normalizedOutcome, itemText })) return false;
    return normalizedOutcome.includes(`claim ${itemText}`)
      || normalizedOutcome.includes(`treat ${itemText} as supported`)
      || normalizedOutcome.includes(`supported ${itemText}`)
      || normalizedOutcome.includes(`strong ${itemText} evidence`);
  });
};

const scoreBooleanChecks = (checks = []) => {
  const earned = checks.filter((check) => check.passed).length;
  return {
    earned,
    possible: checks.length,
    score: checks.length ? Number((earned / checks.length).toFixed(2)) : 1,
  };
};

const renderMarkdown = (summary = {}) => {
  const lines = [
    `# Retrieval Eval`,
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

export const judgeRetrievalCase = (scenario = {}) => {
  const sourceChunks = flattenSources(scenario.sources || {});
  const allSourceText = sourceChunks.map((chunk) => chunk.text).join(' ');
  const expectedRelevantEvidence = scenario.expectedRelevantEvidence || [];
  const blockedEvidence = scenario.blockedEvidence || [];

  const relevantHits = expectedRelevantEvidence.filter((item) => includesPhrase(allSourceText, item));
  const blockedHits = blockedEvidence.filter((item) => includesPhrase(allSourceText, item));

  const queryTokens = unique(normalize(scenario.query || '').split(' ').filter((token) => token.length > 3));
  const sourceTokens = unique(normalize(allSourceText).split(' ').filter((token) => token.length > 3));
  const tokenOverlap = queryTokens.filter((token) => sourceTokens.includes(token));

  const hasExpectedEvidence = expectedRelevantEvidence.length === 0 || relevantHits.length > 0;
  const hasSourceCoverage = sourceChunks.length > 0 || scenario.simulateTimeout === true;
  const degradedFallbackSafe = scenario.simulateTimeout === true
    ? normalize(scenario.expectedOutcome || '').includes('fallback') || normalize(scenario.expectedOutcome || '').includes('degraded')
    : true;
  const noUnsupportedUpgrade = !outcomeClaimsBlockedEvidence({
    outcome: scenario.expectedOutcome,
    blockedEvidence,
  });

  const checks = [
    { label: 'expected_evidence_found_or_not_required', passed: hasExpectedEvidence },
    { label: 'blocked_evidence_not_upgraded_to_supported_claim', passed: noUnsupportedUpgrade },
    { label: 'source_coverage_present_or_safe_timeout', passed: hasSourceCoverage },
    { label: 'degraded_fallback_safe_when_timeout', passed: degradedFallbackSafe },
    { label: 'query_has_some_overlap_or_timeout', passed: tokenOverlap.length > 0 || scenario.simulateTimeout === true },
  ];

  const scored = scoreBooleanChecks(checks);

  return {
    id: scenario.id,
    score: scored.score,
    subScores: {
      relevance: expectedRelevantEvidence.length ? Number((relevantHits.length / expectedRelevantEvidence.length).toFixed(2)) : 1,
      blockedEvidence: noUnsupportedUpgrade ? 1 : 0,
      sourceCoverage: hasSourceCoverage ? 1 : 0,
      degradedFallback: degradedFallbackSafe ? 1 : 0,
    },
    failedChecks: checks.filter((check) => !check.passed).map((check) => check.label),
    diagnostics: {
      relevantHits,
      blockedHits,
      queryTokenOverlap: tokenOverlap,
      sourceTypes: unique(sourceChunks.map((chunk) => chunk.sourceType)),
    },
  };
};

export const runRetrievalEval = async ({ datasetPath, reportRoot, label = 'Retrieval Eval' } = {}) => {
  const scenarios = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const results = scenarios.map((scenario) => judgeRetrievalCase(scenario));
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
    await fs.writeFile(path.join(reportRoot, 'retrieval-eval.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'retrieval-eval.latest.md'), `${renderMarkdown(summary)}\n`);
  }

  return summary;
};
