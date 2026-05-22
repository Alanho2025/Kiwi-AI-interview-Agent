/**
 * File responsibility: Render baseline comparison eval results.
 */

const formatChecks = (checks = []) => checks.length ? checks.join(', ') : '-';

export const renderBaselineComparisonMarkdown = (summary = {}) => [
  `# ${summary.label || 'Baseline Comparison Eval'}`,
  '',
  `- Cases run: ${summary.casesRun}`,
  `- Baseline model fixture: ${(summary.baselineModels || []).join(', ') || 'ChatGPT GPT-5.5 Thinking generated baseline fixture'}`,
  `- Kiwi Agent average score: ${summary.average}`,
  `- Generic ChatGPT-style baseline average score: ${summary.baselineAverage}`,
  `- Average gain: ${summary.averageGain}`,
  `- Win rate: ${summary.winRate}`,
  `- Min average gate: ${summary.thresholds?.minAverage ?? '-'}`,
  `- Per-case fail gate: ${summary.thresholds?.failBelow ?? '-'}`,
  '',
  '## Case results',
  '| case | role | baseline model | baseline | kiwi agent | gain | evidence | STAR | role relevance | NZ context | adaptiveness | kiwi failed checks | baseline failed checks |',
  '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |',
  ...(summary.results || []).map((item) => `| ${item.id} | ${item.role || '-'} | ${item.baselineModel || '-'} | ${item.baselineScore} | ${item.score} | ${item.scoreGain} | ${item.subScores?.evidenceGrounding ?? '-'} | ${item.subScores?.starCoverage ?? '-'} | ${item.subScores?.roleRelevance ?? '-'} | ${item.subScores?.nzContextualisation ?? '-'} | ${item.subScores?.adaptiveness ?? '-'} | ${formatChecks(item.failedChecks)} | ${formatChecks(item.baselineFailedChecks)} |`),
  '',
  '## Interpretation',
  summary.averageGain >= 0
    ? `Kiwi Agent outperformed the generic ChatGPT-style baseline by ${summary.averageGain} average score points under the same deterministic rubric.`
    : `Kiwi Agent underperformed the generic ChatGPT-style baseline by ${Math.abs(summary.averageGain)} average score points under the same deterministic rubric.`,
  'The comparison evaluates workflow reliability rather than raw language fluency: evidence grounding, STAR coverage, role relevance, NZ contextualisation, adaptiveness, and unsupported-claim risk.',
  '',
].join('\n');
