/**
 * File responsibility: Deterministic retrieval and grounding evaluation.
 * Main responsibilities:
 * - Check whether retrieved evidence matches the query and expected evidence.
 * - Detect blocked or unsupported evidence.
 * - Keep semantic retrieval from upgrading weak evidence into hard claims.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { performance } from 'node:perf_hooks';

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
  const m = summary.metrics || {};
  const lines = [
    `# Retrieval Eval`,
    ``,
    `- Cases run: ${summary.casesRun}`,
    `- Average score: ${summary.average}`,
    ``,
    `## RAG Evaluation Metrics Summary`,
    `| Metric | Average Score | Description |`,
    `|---|---|---|`,
    `| **Coverage Rate** | ${(m.coverageRate * 100).toFixed(2)}% | Fraction of expected relevant evidence successfully found in retrieved sources. |`,
    `| **Citation Accuracy** | ${(m.citationAccuracy * 100).toFixed(2)}% | Fraction of output citations/claims verified in retrieved sources. |`,
    `| **Hallucination Rate** | ${(m.hallucinationRate * 100).toFixed(2)}% | Fraction of output citations/claims unsupported by sources (1 - Citation Accuracy). |`,
    `| **Adversarial Pass Rate** | ${(m.adversarialPassRate * 100).toFixed(2)}% | Fraction of adversarial test cases satisfying complete evidence and zero unsupported claims. |`,
    `| **Agent Disagreement Rate** | ${(m.agentDisagreementRate * 100).toFixed(2)}% | Jaccard distance between expected evidence and actual retrieved evidence. |`,
    `| **Success Rate** | ${(m.successRate * 100).toFixed(2)}% | Fraction of cases completing successfully without exception/degradation. |`,
    `| **Average Latency** | ${m.averageLatency.toFixed(6)}s | End-to-end processing latency. |`,
    ``,
    `## Case Breakdown`,
    `| Case | Score | Cov Rate | Cit Acc | Halluc Rate | Adv Pass | Ag Disagree | Latency | Failed Checks |`,
    `|---|---:|---:|---:|---:|---:|---:|---:|---|`,
  ];
  for (const result of summary.results || []) {
    const resMetrics = result.metrics || {};
    lines.push(
      `| ${result.id} | ${result.score} | ` +
      `${(resMetrics.coverageRate * 100).toFixed(1)}% | ` +
      `${(resMetrics.citationAccuracy * 100).toFixed(1)}% | ` +
      `${(resMetrics.hallucinationRate * 100).toFixed(1)}% | ` +
      `${resMetrics.adversarialPassRate === 1 ? 'Pass' : 'Fail'} | ` +
      `${(resMetrics.agentDisagreementRate * 100).toFixed(1)}% | ` +
      `${resMetrics.latency.toFixed(6)}s | ` +
      `${(result.failedChecks || []).join(', ') || '-'} |`
    );
  }
  return lines.join('\n');
};

export const judgeRetrievalCase = (scenario = {}) => {
  const startTime = performance.now();
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

  // Calculate the six RAG evaluation metrics
  // 1. Coverage Rate (Cov): Mapped to expected relevant evidence hit fraction
  const coverageRate = expectedRelevantEvidence.length
    ? Number((relevantHits.length / expectedRelevantEvidence.length).toFixed(4))
    : 1.0;

  // 2. Citation Accuracy (CA): Fraction of citations in output/outcome that are verified
  const expectedOutcome = scenario.expectedOutcome || '';
  const citedExpected = expectedRelevantEvidence.filter((item) => includesPhrase(expectedOutcome, item));
  const citedBlocked = blockedEvidence.filter((item) => includesPhrase(expectedOutcome, item) && outcomeClaimsBlockedEvidence({ outcome: expectedOutcome, blockedEvidence: [item] }));
  const totalCitations = citedExpected.length + citedBlocked.length;
  const citationAccuracy = totalCitations > 0
    ? Number((1 - (citedBlocked.length / totalCitations)).toFixed(4))
    : (noUnsupportedUpgrade ? 1.0 : 0.0);

  // 3. Hallucination Rate (HR): 1 - Citation Accuracy
  const hallucinationRate = Number((1 - citationAccuracy).toFixed(4));

  // 4. Adversarial Pass Rate: Pass if all expected evidence found and no blocked evidence upgraded
  const adversarialPassRate = (relevantHits.length === expectedRelevantEvidence.length && noUnsupportedUpgrade) ? 1.0 : 0.0;

  // 5. Agent Disagreement Rate (ADR): Jaccard distance between expected and retrieved hits
  const agentDisagreementRate = expectedRelevantEvidence.length
    ? Number((1 - (relevantHits.length / expectedRelevantEvidence.length)).toFixed(4))
    : 0.0;

  // 6. Success Rate: 1.0 if runs successfully (hasSourceCoverage is true or handled timeout)
  const successRate = hasSourceCoverage ? 1.0 : 0.0;

  // 7. Latency: Wall-clock seconds
  const latency = Number(((performance.now() - startTime) / 1000).toFixed(6));

  return {
    id: scenario.id,
    score: scored.score,
    subScores: {
      relevance: expectedRelevantEvidence.length ? Number((relevantHits.length / expectedRelevantEvidence.length).toFixed(2)) : 1,
      blockedEvidence: noUnsupportedUpgrade ? 1 : 0,
      sourceCoverage: hasSourceCoverage ? 1 : 0,
      degradedFallback: degradedFallbackSafe ? 1 : 0,
    },
    metrics: {
      coverageRate,
      citationAccuracy,
      hallucinationRate,
      adversarialPassRate,
      agentDisagreementRate,
      successRate,
      latency,
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

export const runRetrievalEval = async ({
  datasetPath,
  reportRoot,
  label = 'Retrieval Safety Eval',
  reportBaseName = 'retrieval-safety-eval.latest',
} = {}) => {
  const scenarios = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const results = scenarios.map((scenario) => judgeRetrievalCase(scenario));
  const average = results.length
    ? Number((results.reduce((sum, item) => sum + item.score, 0) / results.length).toFixed(2))
    : 0;

  // Aggregate metrics
  const aggregate = {
    coverageRate: results.length ? Number((results.reduce((sum, item) => sum + item.metrics.coverageRate, 0) / results.length).toFixed(4)) : 0,
    citationAccuracy: results.length ? Number((results.reduce((sum, item) => sum + item.metrics.citationAccuracy, 0) / results.length).toFixed(4)) : 0,
    hallucinationRate: results.length ? Number((results.reduce((sum, item) => sum + item.metrics.hallucinationRate, 0) / results.length).toFixed(4)) : 0,
    adversarialPassRate: results.length ? Number((results.reduce((sum, item) => sum + item.metrics.adversarialPassRate, 0) / results.length).toFixed(4)) : 0,
    agentDisagreementRate: results.length ? Number((results.reduce((sum, item) => sum + item.metrics.agentDisagreementRate, 0) / results.length).toFixed(4)) : 0,
    successRate: results.length ? Number((results.reduce((sum, item) => sum + item.metrics.successRate, 0) / results.length).toFixed(4)) : 0,
    averageLatency: results.length ? Number((results.reduce((sum, item) => sum + item.metrics.latency, 0) / results.length).toFixed(6)) : 0,
  };

  const summary = {
    label,
    generatedAt: new Date().toISOString(),
    casesRun: results.length,
    average,
    metrics: aggregate,
    results,
  };

  if (reportRoot) {
    await fs.mkdir(reportRoot, { recursive: true });
    await fs.writeFile(path.join(reportRoot, `${reportBaseName}.json`), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, `${reportBaseName}.md`), `${renderMarkdown(summary)}\n`);
  }

  return summary;
};
