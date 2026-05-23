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
  `- Evaluation method: ${summary.evaluationMethod || 'Fixed interview scenario evaluation covering flow validity, question quality, and report grounding. It does not call production routes, databases, voice runtime, or live AI services.'}`,
  `- Average score: ${summary.average}`,
  `- Min average gate: ${summary.thresholds?.minAverage ?? '-'}`,
  `- Per-case fail gate: ${summary.thresholds?.failBelow ?? '-'}`,
  '',
  '## Case results',
  '| case | score | flow | question quality | report grounding | failed checks |',
  '| --- | ---: | ---: | ---: | ---: | --- |',
  ...(summary.results || []).map((item) => `| ${item.id} | ${item.score} | ${item.subScores?.flow ?? '-'} | ${item.subScores?.questionQuality ?? '-'} | ${item.subScores?.reportGrounding ?? '-'} | ${(item.failedChecks || []).join(', ') || '-'} |`),
  '',
  '## Interpretation',
  'These reports evaluate fixed interview transcripts and report artifacts. They are useful for repeatable flow and grounding checks, but they are not evidence of a live production E2E run.',
  '',
].join('\n');
