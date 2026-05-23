import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { renderBaselineComparisonMarkdown } from '../../../eval/baseline/baselineComparisonReporter.js';
import { summarizeBaselineComparison } from '../../../eval/baseline/baselineComparisonEvaluator.js';
import { renderGreenAgentMarkdown } from '../../../eval/greenAgent/failureReporter.js';
import { aggregateEvalResults } from '../../../eval/greenAgent/metricAggregator.js';

const backendRoot = path.resolve(process.cwd());
const read = (relativePath) => fs.readFileSync(path.join(backendRoot, relativePath), 'utf8');

describe('eval reporting contracts', () => {
  it('renders baseline comparison as a semantic-judge feedback benchmark', () => {
    const summary = summarizeBaselineComparison({
      thresholds: { minAverage: 0.8, failBelow: 0.7 },
      results: [{
        id: 'case-1',
        role: 'Data Engineer',
        baselineModel: 'ChatGPT GPT-5.5 Thinking same-input baseline run',
        judgeModel: 'deepseek-chat',
        score: 0.92,
        baselineScore: 0.84,
        scoreGain: 0.08,
        failedChecks: [],
        baselineFailedChecks: ['low_semantic_score'],
        diagnostics: {
          semanticScores: { kiwi: 0.92, baseline: 0.84 },
          safetyPenalty: { kiwi: 0, baseline: 0.15 },
          kiwiRationale: 'Grounded and actionable.',
          baselineRationale: 'Useful but invented one detail.',
        },
      }],
    });

    const markdown = renderBaselineComparisonMarkdown(summary);

    expect(markdown).toContain('Evaluation method: DeepSeek semantic judge as primary score; keyword matching retained as diagnostics; forbidden claims retained as safety penalty.');
    expect(markdown).toContain('| case | role | judge model | baseline model | baseline semantic score | kiwi semantic score | safety penalty | gain | rationale | failed checks |');
    expect(markdown).toContain('feedback-level benchmark only');
    expect(markdown).not.toContain('under the same deterministic rubric');
    expect(markdown).not.toContain('| evidence | STAR | role relevance | NZ context | adaptiveness |');
  });

  it('keeps baseline eval judge calls sequential to reduce rate-limit flake', () => {
    const runnerSource = read('eval/runners/runBaselineComparisonEval.js');

    expect(runnerSource).toMatch(/for \(const scenario of scenarios\)/);
    expect(runnerSource).not.toMatch(/Promise\.all\(scenarios\.map/);
  });

  it('labels green-agent and e2e reports as fixed scenario evaluations, not live product E2E', () => {
    const summary = aggregateEvalResults({
      label: 'End-to-End Interview Eval',
      thresholds: { minAverage: 0.85 },
      results: [{
        id: 'scenario-1',
        score: 1,
        subScores: { flow: 1, questionQuality: 1, reportGrounding: 1 },
        failedChecks: [],
      }],
    });

    const markdown = renderGreenAgentMarkdown(summary);

    expect(summary.evaluationMethod).toContain('Fixed interview scenario evaluation');
    expect(summary.evaluationMethod).toContain('does not call production routes');
    expect(markdown).toContain('not evidence of a live production E2E run');
  });

  it('splits local quality checks from real AI evals', () => {
    const pkg = JSON.parse(read('package.json'));

    expect(pkg.scripts['quality:local']).toContain('npm run eval:local');
    expect(pkg.scripts['quality:local']).not.toContain('eval:baseline');
    expect(pkg.scripts['quality:real']).toBe('npm run eval:real');
    expect(pkg.scripts['eval:real']).toContain('npm run eval:baseline');
    expect(pkg.scripts['eval:local']).toContain('npm run eval:e2e');
    expect(pkg.scripts['eval:local']).toContain('npm run eval:voice-robustness');
  });
});
