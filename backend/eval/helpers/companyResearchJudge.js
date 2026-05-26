/**
 * File responsibility: Company research grounding evaluation.
 * Main responsibilities:
 * - Prevent invented company facts when evidence is missing or ambiguous.
 * - Check whether generated company questions and report comments are grounded.
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
    `# Company Research Eval`,
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

export const judgeCompanyResearchCase = (scenario = {}) => {
  const combinedText = `${scenario.generatedQuestion || ''} ${scenario.reportComment || ''}`;
  const expected = scenario.expected || {};
  const blockedHits = containsBlocked(combinedText, expected.mustNotContain || []);

  const hasRequiredSafeText = (expected.mustContainOneOf || []).length
    ? containsAny(combinedText, expected.mustContainOneOf)
    : true;
  const noBlockedClaims = blockedHits.length === 0;
  const hasSearchEvidenceOrCaution = (scenario.searchResults || []).length > 0
    || containsAny(combinedText, ['research', 'confirm', 'no reliable company evidence', 'ambiguous']);

  const checks = [
    { label: 'safe_required_text_present', passed: hasRequiredSafeText },
    { label: 'no_blocked_company_claims', passed: noBlockedClaims },
    { label: 'evidence_or_caution_present', passed: hasSearchEvidenceOrCaution },
  ];

  const earned = checks.filter((check) => check.passed).length;
  const score = Number((earned / checks.length).toFixed(2));

  return {
    id: scenario.id,
    score,
    failedChecks: checks.filter((check) => !check.passed).map((check) => check.label),
    diagnostics: {
      companyName: scenario.companyName,
      searchResultCount: (scenario.searchResults || []).length,
      blockedHits,
      generatedQuestion: scenario.generatedQuestion,
      reportComment: scenario.reportComment,
    },
  };
};

export const runCompanyResearchEval = async ({ datasetPath, reportRoot, label = 'Company Research Eval' } = {}) => {
  const scenarios = JSON.parse(await fs.readFile(datasetPath, 'utf8'));
  const results = scenarios.map((scenario) => judgeCompanyResearchCase(scenario));
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
    await fs.writeFile(path.join(reportRoot, 'company-research-eval.latest.json'), `${JSON.stringify(summary, null, 2)}\n`);
    await fs.writeFile(path.join(reportRoot, 'company-research-eval.latest.md'), `${renderMarkdown(summary)}\n`);
  }

  return summary;
};
