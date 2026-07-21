import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { renderBaselineComparisonMarkdown } from '../../../eval/baseline/baselineComparisonReporter.js';
import { summarizeBaselineComparison } from '../../../eval/baseline/baselineComparisonEvaluator.js';
import { renderGreenAgentMarkdown } from '../../../eval/greenAgent/failureReporter.js';
import { aggregateEvalResults } from '../../../eval/greenAgent/metricAggregator.js';
import {
  buildRoleFitCutoverRetentionSummary,
  buildRoleFitReleaseGateSummary,
} from '../../../eval/helpers/roleFitReleaseGateEvaluator.js';

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

  it('allows the Role-Fit final claim when non-SLO gates pass and voice 3s is recorded as a known issue', () => {
    const summary = buildRoleFitReleaseGateSummary({
      calibrationSummary: {
        status: 'calibrated',
        totalCases: 12,
        reviewedCases: 12,
        thresholdDecision: { status: 'approved', value: 0.85 },
        canAssertNumericalReleaseThreshold: true,
      },
      adversarialSummary: {
        datasetChecksPassed: true,
        productionClaimAllowed: true,
        totalCases: 12,
      },
      cutoverRetentionSummary: {
        status: 'passed',
      },
      browserVisualSummary: {
        passed: true,
        screenshotCount: 2,
        assertions: ['role_fit_section_visible'],
      },
      voiceFlowSummary: {
        passed: true,
        assistantFirstAudioMs: 4200,
        turnDoneMs: 4800,
      },
    });

    expect(summary.finalClaimAllowed).toBe(true);
    expect(summary.releaseStatus).toBe('ready_with_known_issues');
    expect(summary.releaseBlockers).toEqual([]);
    expect(summary.knownIssues).toContain('voice_next_question_3s_slo_exceeded');
    expect(summary.gates.voiceThreeSecondSlo.status).toBe('known_issue');
    expect(summary.gates.voiceFlow.status).toBe('passed');
  });

  it('blocks the Role-Fit final claim when browser visual evidence is missing', () => {
    const summary = buildRoleFitReleaseGateSummary({
      calibrationSummary: {
        status: 'calibrated',
        totalCases: 12,
        reviewedCases: 12,
        thresholdDecision: { status: 'approved', value: 0.85 },
        canAssertNumericalReleaseThreshold: true,
      },
      adversarialSummary: {
        datasetChecksPassed: true,
        productionClaimAllowed: true,
        totalCases: 12,
      },
      cutoverRetentionSummary: {
        status: 'passed',
      },
      browserVisualSummary: null,
      voiceFlowSummary: {
        passed: true,
        assistantFirstAudioMs: 1800,
        turnDoneMs: 2400,
      },
    });

    expect(summary.finalClaimAllowed).toBe(false);
    expect(summary.releaseStatus).toBe('blocked');
    expect(summary.releaseBlockers).toContain('browser_visual_not_run');
  });

  it('summarizes the local Role-Fit cutover and retention contract from source', async () => {
    const summary = await buildRoleFitCutoverRetentionSummary({ backendRoot });

    expect(summary.status).toBe('passed');
    expect(summary.registeredCollections).toEqual(expect.arrayContaining([
      'companyvaluesprofiles',
      'interviewplans',
      'interviewquestionpoolitems',
      'matchanalysisrecords',
      'sessionanalyses',
      'sessionreports',
    ]));
    expect(summary.removedLegacyEntrypoints).toBe(true);
    expect(summary.defaultQuestionSchemaVersion).toBe('v3');
    expect(summary.productionTelemetryAvailable).toBe(false);
  });
});
