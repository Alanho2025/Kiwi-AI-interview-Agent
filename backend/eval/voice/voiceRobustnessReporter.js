/**
 * File responsibility: Render voice robustness eval results.
 */

const formatChecks = (checks = []) => checks.length ? checks.join(', ') : '-';

export const renderVoiceRobustnessMarkdown = (summary = {}) => [
  `# ${summary.label || 'Voice Robustness Eval'}`,
  '',
  `- Cases run: ${summary.casesRun}`,
  `- Average score: ${summary.average}`,
  `- Accepted cases: ${summary.acceptedCases}`,
  `- Rejected cases: ${summary.rejectedCases}`,
  `- Min average gate: ${summary.thresholds?.minAverage ?? '-'}`,
  `- Per-case fail gate: ${summary.thresholds?.failBelow ?? '-'}`,
  '',
  '## Case results',
  '| case | score | expected | actual | expected reason | actual reason | decision | reason | message | failed checks |',
  '| --- | ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |',
  ...(summary.results || []).map((item) => `| ${item.id} | ${item.score} | ${item.expectedOutcome} | ${item.actualOutcome} | ${item.expectedReason || '-'} | ${item.actualReason || '-'} | ${item.subScores?.decision ?? '-'} | ${item.subScores?.reason ?? '-'} | ${item.subScores?.message ?? '-'} | ${formatChecks(item.failedChecks)} |`),
  '',
  '## Interpretation',
  'This benchmark checks whether the voice input layer blocks unsafe or unclear transcripts before they are saved as interview answers. It covers silence, empty transcript, low-confidence STT, incomplete VAD, accented but clear speech, and domain-specific terminology.',
  '',
].join('\n');
