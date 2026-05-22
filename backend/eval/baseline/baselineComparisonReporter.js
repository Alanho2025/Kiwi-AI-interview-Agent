/**
 * File responsibility: Render baseline comparison eval results.
 */

const formatChecks = (checks = []) => checks.length ? checks.join(', ') : '-';
const formatRationale = (...values) => values.map((value) => String(value || '').replace(/\s+/g, ' ').trim()).filter(Boolean).join(' / ') || '-';

export const renderBaselineComparisonMarkdown = (summary = {}) => [
  `# ${summary.label || 'Baseline Comparison Eval'}`,
  '',
  `- Cases run: ${summary.casesRun}`,
  `- Evaluation method: ${summary.evaluationMethod || 'DeepSeek semantic judge as primary score; keyword matching retained as diagnostics; forbidden claims retained as safety penalty.'}`,
  `- Judge model: ${(summary.judgeModels || []).join(', ') || '-'}`,
  `- Baseline model fixture: ${(summary.baselineModels || []).join(', ') || 'ChatGPT GPT-5.5 Thinking generated baseline fixture'}`,
  `- Kiwi Agent average score: ${summary.average}`,
  `- Generic ChatGPT-style baseline average score: ${summary.baselineAverage}`,
  `- Average gain: ${summary.averageGain}`,
  `- Win rate: ${summary.winRate}`,
  `- Min average gate: ${summary.thresholds?.minAverage ?? '-'}`,
  `- Per-case fail gate: ${summary.thresholds?.failBelow ?? '-'}`,
  '',
  '## Case results',
  '| case | role | judge model | baseline model | baseline semantic score | kiwi semantic score | safety penalty | gain | rationale | failed checks |',
  '| --- | --- | --- | --- | ---: | ---: | ---: | ---: | --- | --- |',
  ...(summary.results || []).map((item) => `| ${item.id} | ${item.role || '-'} | ${item.judgeModel || '-'} | ${item.baselineModel || '-'} | ${item.diagnostics?.semanticScores?.baseline ?? '-'} | ${item.diagnostics?.semanticScores?.kiwi ?? '-'} | kiwi ${item.diagnostics?.safetyPenalty?.kiwi ?? 0} / baseline ${item.diagnostics?.safetyPenalty?.baseline ?? 0} | ${item.scoreGain} | ${formatRationale(item.diagnostics?.kiwiRationale, item.diagnostics?.baselineRationale)} | kiwi: ${formatChecks(item.failedChecks)}; baseline: ${formatChecks(item.baselineFailedChecks)} |`),
  '',
  '## Interpretation',
  summary.averageGain >= 0
    ? `Kiwi Agent outperformed the generic ChatGPT-style baseline by ${summary.averageGain} average score points under the semantic judge method.`
    : `Kiwi Agent underperformed the generic ChatGPT-style baseline by ${Math.abs(summary.averageGain)} average score points under the semantic judge method.`,
  'This is a feedback-level benchmark only: it compares same-input baseline feedback against Kiwi Agent feedback. It does not exercise CV upload, JD parsing, interview runtime, voice, storage, auth, UI, or report download flows.',
  '',
].join('\n');
