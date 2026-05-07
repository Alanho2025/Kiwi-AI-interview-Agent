/**
 * File responsibility: Render green-agent evaluation results for humans.
 * Main responsibilities:
 * - Convert benchmark JSON into a compact markdown report.
 * - Surface weak cases, sub-scores, and failed checks without requiring manual JSON reading.
 */

export const renderGreenAgentMarkdown = (summary = {}) => [
  `# ${summary.label || 'Kiwi Green Agent Eval'}`,
  '',
  `- Cases run: ${summary.casesRun}`,
  `- Average score: ${summary.average}`,
  `- Min average gate: ${summary.thresholds?.minAverage ?? '-'}`,
  `- Per-case fail gate: ${summary.thresholds?.failBelow ?? '-'}`,
  '',
  '## Case results',
  '| case | score | flow | question quality | report grounding | failed checks |',
  '| --- | ---: | ---: | ---: | ---: | --- |',
  ...(summary.results || []).map((item) => `| ${item.id} | ${item.score} | ${item.subScores?.flow ?? '-'} | ${item.subScores?.questionQuality ?? '-'} | ${item.subScores?.reportGrounding ?? '-'} | ${(item.failedChecks || []).join(', ') || '-'} |`),
  '',
].join('\n');
